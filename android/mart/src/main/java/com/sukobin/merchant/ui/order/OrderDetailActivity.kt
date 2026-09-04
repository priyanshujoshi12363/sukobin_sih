package com.sukobin.merchant.ui.order

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.CartItem
import com.sukobin.core.net.Order
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.ui.Motion
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityOrderDetailBinding
import com.sukobin.merchant.databinding.ItemOrderLineBinding
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * The shopkeeper's view of one order, and the only place its status moves.
 * The transitions offered here mirror what the server will accept, so the app
 * never shows a button that is going to be rejected.
 */
class OrderDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ID = "orderId"

        private val NEXT = mapOf(
            "PLACED" to listOf("ACCEPTED" to R.string.order_accept, "CANCELLED" to R.string.order_cancel),
            "ACCEPTED" to listOf("PREPARING" to R.string.order_start_packing, "CANCELLED" to R.string.order_cancel),
            "PREPARING" to listOf("READY_FOR_PICKUP" to R.string.order_ready, "CANCELLED" to R.string.order_cancel)
        )
    }

    private lateinit var b: ActivityOrderDetailBinding
    private var id = ""
    private var order: Order? = null

    private val lines = OrderLineAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityOrderDetailBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        id = intent.getStringExtra(EXTRA_ID).orEmpty()

        b.btnBack.setOnClickListener { finish() }
        b.itemList.layoutManager = LinearLayoutManager(this)
        b.itemList.adapter = lines
        b.itemList.isNestedScrollingEnabled = false
        b.btnCall.setOnClickListener { callCustomer() }

        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { merchantOrderDetail(id) }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    order = r.value.decode("order")
                    order?.let { render(it) }
                }
                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    b.errorText.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun render(o: Order) {
        b.content.visibility = View.VISIBLE

        b.orderRef.text = o.orderId ?: o.id.takeLast(8)
        b.orderStatus.text = o.status.replace("_", " ")
        b.orderStatus.setBackgroundResource(statusPill(o.status))

        b.customerAddress.text = o.deliveryAddress?.display().orEmpty()
        b.paymentLine.text = listOfNotNull(o.paymentMethod, o.paymentStatus)
            .joinToString(" · ")

        lines.submitList(o.items)

        b.billSubtotal.text = "₹" + o.subtotal.roundToInt()
        b.billDelivery.text = "₹" + o.deliveryFee.roundToInt()
        b.billPlatform.text = "₹" + o.platformFee.roundToInt()
        b.billTotal.text = "₹" + o.totalAmount.roundToInt()

        renderActions(o.status)
    }

    private fun renderActions(status: String) {
        b.actionRow.removeAllViews()
        val options = NEXT[status]

        if (options.isNullOrEmpty()) {
            b.actionRow.visibility = View.GONE
            b.noActionLine.visibility = View.VISIBLE
            b.noActionLine.text = getString(R.string.order_no_action, status.replace("_", " ").lowercase())
            return
        }

        b.actionRow.visibility = View.VISIBLE
        b.noActionLine.visibility = View.GONE

        val density = resources.displayMetrics.density
        for ((target, label) in options) {
            val destructive = target == "CANCELLED"
            val button = android.widget.TextView(this).apply {
                text = getString(label)
                gravity = android.view.Gravity.CENTER
                textSize = 14f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(
                    androidx.core.content.ContextCompat.getColor(
                        this@OrderDetailActivity,
                        if (destructive) com.sukobin.core.R.color.gray_700 else com.sukobin.core.R.color.white
                    )
                )
                setBackgroundResource(
                    if (destructive) com.sukobin.core.R.drawable.bg_pill_gray
                    else com.sukobin.core.R.drawable.bg_button_dark_lg
                )
                layoutParams = android.widget.LinearLayout.LayoutParams(
                    0, (50 * density).toInt(), if (destructive) 1f else 1.6f
                ).apply { marginEnd = (8 * density).toInt() }
                setOnClickListener { confirm(target, getString(label)) }
            }
            b.actionRow.addView(button)
        }
    }

    private fun confirm(target: String, label: String) {
        val message = when (target) {
            "CANCELLED" -> getString(R.string.order_confirm_cancel)
            "READY_FOR_PICKUP" -> getString(R.string.order_confirm_ready)
            else -> getString(R.string.order_confirm_generic, label.lowercase())
        }

        AlertDialog.Builder(this)
            .setTitle(label)
            .setMessage(message)
            .setNegativeButton(R.string.common_cancel, null)
            .setPositiveButton(label) { _, _ -> updateStatus(target) }
            .show()
    }

    private fun updateStatus(target: String) {
        lifecycleScope.launch {
            val r = apiCall {
                merchantUpdateOrderStatus(id, jsonOf("status" to target))
            }

            when (r) {
                is ApiResult.Ok -> {
                    Toast.makeText(
                        this@OrderDetailActivity,
                        getString(R.string.order_updated, target.replace("_", " ").lowercase()),
                        Toast.LENGTH_SHORT
                    ).show()
                    load()
                }
                is ApiResult.Err ->
                    Toast.makeText(this@OrderDetailActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun callCustomer() {
        val phone = order?.customerPhone
        if (phone.isNullOrBlank()) {
            Toast.makeText(this, getString(R.string.order_no_phone), Toast.LENGTH_SHORT).show()
            return
        }
        try {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
        } catch (e: Exception) {
            Toast.makeText(this, getString(R.string.order_no_phone), Toast.LENGTH_SHORT).show()
        }
    }

    private fun statusPill(status: String) = when (status) {
        "PLACED" -> R.drawable.bg_pill_new
        "CANCELLED" -> R.drawable.bg_pill_hidden
        "DELIVERED" -> R.drawable.bg_pill_live
        else -> R.drawable.bg_pill_working
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}

class OrderLineAdapter : ListAdapter<CartItem, OrderLineAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<CartItem>() {
            override fun areItemsTheSame(a: CartItem, b: CartItem) =
                a.product?.id == b.product?.id
            override fun areContentsTheSame(a: CartItem, b: CartItem) = a == b
        }
    }

    inner class VH(val b: ItemOrderLineBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemOrderLineBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val item = getItem(position)
        val b = holder.b

        b.lineName.text = item.product?.productName ?: "-"
        b.lineQty.text = "x" + item.quantity
        b.lineTotal.text = "₹" + (item.price * item.quantity).roundToInt()
        b.lineImage.load(item.product?.thumbnail) { crossfade(true) }
    }
}
