package com.sukobin.app.ui.cart

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.core.ui.Motion
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.gson.JsonObject
import com.razorpay.Checkout
import com.razorpay.PaymentResultWithDataListener
import com.sukobin.app.R
import com.sukobin.app.data.CartStore
import com.sukobin.app.databinding.ActivityCheckoutBinding
import com.sukobin.app.databinding.ItemCartBinding
import com.sukobin.core.net.Address
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.CartItem
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import kotlinx.coroutines.launch
import org.json.JSONObject
import kotlin.math.roundToInt

class CheckoutItemAdapter : ListAdapter<CartItem, CheckoutItemAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<CartItem>() {
            override fun areItemsTheSame(a: CartItem, b: CartItem) = a.product?.id == b.product?.id
            override fun areContentsTheSame(a: CartItem, b: CartItem) = a == b
        }
    }

    inner class VH(val b: ItemCartBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemCartBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = getItem(position)
        val b = holder.b

        b.itemName.text = item.product?.productName ?: "-"
        b.itemPrice.text = "₹" + item.price.roundToInt()
        b.itemLineTotal.text = "x" + item.quantity + "  =  ₹" + item.lineTotal.roundToInt()
        b.itemQty.text = item.quantity.toString()
        b.itemImage.load(item.product?.thumbnail) { crossfade(true) }

        // read-only on the checkout summary
        b.btnPlus.visibility = View.GONE
        b.btnMinus.visibility = View.GONE
    }
}

class CheckoutActivity : AppCompatActivity(), PaymentResultWithDataListener {

    private lateinit var b: ActivityCheckoutBinding
    private val adapter = CheckoutItemAdapter()

    private var paying = false
    private var pendingOrderId: String? = null
    private var pendingAmount: Double = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityCheckoutBinding.inflate(layoutInflater)
        setContentView(b.root)

        Motion.applyEnter(this)

        Checkout.preload(applicationContext)

        b.itemList.layoutManager = LinearLayoutManager(this)
        b.itemList.adapter = adapter

        b.btnBack.setOnClickListener { finish() }
        b.btnRetry.setOnClickListener { load() }
        b.btnPay.setOnClickListener { startPayment() }

        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE
        b.errorState.visibility = View.GONE
        b.content.visibility = View.GONE
        b.bottomBar.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { checkoutSummary(jsonOf()) }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    val summary = r.value.obj("checkout")
                    if (summary == null) showError(getString(R.string.common_error))
                    else render(summary)
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    showError(r.message)
                }
            }
        }
    }

    private fun render(checkout: JsonObject) {
        b.content.visibility = View.VISIBLE
        b.bottomBar.visibility = View.VISIBLE

        val customer = checkout.obj("customer")
        b.customerName.text = customer?.str("name").orEmpty()

        val address = checkout.decode<Address>("deliveryAddress")
        b.deliveryAddress.text = address?.display().orEmpty()

        val shop = checkout.obj("shop")
        b.shopName.text = shop?.str("shopName").orEmpty()
        b.shopLogo.load(shop?.str("shopLogo")) { crossfade(true) }

        val distance = checkout.str("distance")
        b.distanceLine.text = distance?.let { "$it km away" }.orEmpty()

        adapter.submitList(checkout.decodeList<CartItem>("items"))

        val subtotal = checkout.num("subtotal")
        val delivery = checkout.num("deliveryFee")
        val platform = checkout.num("platformFee")
        val total = checkout.num("totalAmount")

        b.billSubtotal.text = "₹" + subtotal.roundToInt()
        b.billDelivery.text = "₹" + delivery.roundToInt()
        b.billPlatform.text = "₹" + platform.roundToInt()
        b.billTotal.text = "₹" + total.roundToInt()
        b.barTotal.text = "₹" + total.roundToInt()
    }

    private fun showError(message: String) {
        b.errorState.visibility = View.VISIBLE
        b.errorText.text = message
    }

    private fun startPayment() {
        if (paying) return
        setPaying(true)

        lifecycleScope.launch {
            when (val r = apiCall { createOrder(jsonOf()) }) {
                is ApiResult.Ok -> openRazorpay(r.value)
                is ApiResult.Err -> {
                    setPaying(false)
                    toast(r.message)
                }
            }
        }
    }

    private fun openRazorpay(data: JsonObject) {
        val key = data.str("key")
        val razorpayOrderId = data.str("razorpayOrderId")
        val amountPaise = data.num("amount")

        if (key.isNullOrBlank() || razorpayOrderId.isNullOrBlank()) {
            setPaying(false)
            toast(getString(R.string.pay_failed))
            return
        }

        pendingOrderId = data.str("orderId")
        pendingAmount = data.obj("summary")?.num("totalAmount") ?: (amountPaise / 100.0)

        val prefill = data.obj("prefill")

        val options = JSONObject().apply {
            put("name", "Sukobin")
            put("description", "Order " + (pendingOrderId ?: ""))
            put("order_id", razorpayOrderId)
            put("currency", data.str("currency") ?: "INR")
            put("amount", amountPaise)
            put("theme", JSONObject().put("color", "#1A3D2B"))
            put("retry", JSONObject().put("enabled", true).put("max_count", 2))
            put(
                "prefill",
                JSONObject().apply {
                    prefill?.str("name")?.let { put("name", it) }
                    prefill?.str("contact")?.let { put("contact", it) }
                }
            )
        }

        try {
            val checkout = Checkout()
            checkout.setKeyID(key)
            checkout.open(this, options)
        } catch (e: Exception) {
            setPaying(false)
            toast(e.message ?: getString(R.string.pay_failed))
        }
    }

    override fun onPaymentSuccess(paymentId: String?, data: com.razorpay.PaymentData?) {
        val orderId = data?.orderId
        val signature = data?.signature

        if (paymentId == null || orderId == null || signature == null) {
            setPaying(false)
            toast(getString(R.string.pay_failed))
            return
        }

        toast(getString(R.string.pay_verifying))

        lifecycleScope.launch {
            val r = apiCall {
                verifyOrderPayment(
                    jsonOf(
                        "razorpay_order_id" to orderId,
                        "razorpay_payment_id" to paymentId,
                        "razorpay_signature" to signature
                    )
                )
            }

            setPaying(false)

            when (r) {
                is ApiResult.Ok -> {
                    CartStore.clear()
                    val order = r.value.obj("order")
                    startActivity(
                        Intent(this@CheckoutActivity, OrderSuccessActivity::class.java)
                            .putExtra(
                                OrderSuccessActivity.EXTRA_ORDER_ID,
                                order?.str("orderId") ?: pendingOrderId
                            )
                            .putExtra(
                                OrderSuccessActivity.EXTRA_AMOUNT,
                                order?.num("totalAmount") ?: pendingAmount
                            )
                            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    )
                    finish()
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    override fun onPaymentError(code: Int, response: String?, data: com.razorpay.PaymentData?) {
        setPaying(false)
        toast(getString(R.string.pay_cancelled))
    }

    private fun setPaying(value: Boolean) {
        paying = value
        b.paySpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnPay.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
