package com.sukobin.app.ui.cart

import android.content.Intent
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
import com.sukobin.app.R
import com.sukobin.app.data.CartStore
import com.sukobin.app.databinding.ActivityCartBinding
import com.sukobin.app.databinding.ItemCartBinding
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Cart
import com.sukobin.core.net.CartItem
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class CartAdapter(
    private val onChange: (CartItem, Int) -> Unit
) : ListAdapter<CartItem, CartAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<CartItem>() {
            override fun areItemsTheSame(a: CartItem, b: CartItem) =
                a.product?.id == b.product?.id

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
        b.itemLineTotal.text = "₹" + item.lineTotal.roundToInt() + " total"
        b.itemQty.text = item.quantity.toString()
        b.itemImage.load(item.product?.thumbnail) { crossfade(true) }

        b.btnPlus.setOnClickListener { onChange(item, item.quantity + 1) }
        b.btnMinus.setOnClickListener { onChange(item, item.quantity - 1) }
    }
}

class CartActivity : AppCompatActivity() {

    private lateinit var b: ActivityCartBinding
    private lateinit var adapter: CartAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityCartBinding.inflate(layoutInflater)
        setContentView(b.root)

        adapter = CartAdapter { item, qty -> change(item, qty) }
        b.cartList.layoutManager = LinearLayoutManager(this)
        b.cartList.adapter = adapter

        b.btnBack.setOnClickListener { finish() }
        b.btnBrowse.setOnClickListener { finish() }
        b.btnClear.setOnClickListener { confirmClear() }
        b.btnCheckout.setOnClickListener {
            startActivity(Intent(this, CheckoutActivity::class.java))
        }

        load()
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            val result = apiCall { cart() }
            b.loading.visibility = View.GONE

            when (result) {
                is ApiResult.Ok -> render(result.value.decode<Cart>("cart"))
                is ApiResult.Err -> {
                    render(null)
                    toast(result.message)
                }
            }
        }
    }

    private fun render(cart: Cart?) {
        val items = cart?.items.orEmpty().filter { it.quantity > 0 }

        if (items.isEmpty()) {
            b.emptyState.visibility = View.VISIBLE
            b.scroll.visibility = View.GONE
            b.bottomBar.visibility = View.GONE
            b.btnClear.visibility = View.GONE
            return
        }

        b.emptyState.visibility = View.GONE
        b.scroll.visibility = View.VISIBLE
        b.bottomBar.visibility = View.VISIBLE
        b.btnClear.visibility = View.VISIBLE

        adapter.submitList(items)

        val shop = cart?.shop
        b.shopRow.visibility = if (shop?.shopName != null) View.VISIBLE else View.GONE
        b.shopName.text = shop?.shopName.orEmpty()
        b.shopLogo.load(shop?.shopLogo) { crossfade(true) }

        val subtotal = items.sumOf { it.lineTotal }
        val count = items.sumOf { it.quantity }

        b.billCard.visibility = View.VISIBLE
        b.billSubtotal.text = "₹" + subtotal.roundToInt()
        b.billItems.text = count.toString()

        b.barTotal.text = "₹" + subtotal.roundToInt()
        b.barItems.text = if (count == 1) "1 item" else "$count items"
    }

    private fun change(item: CartItem, quantity: Int) {
        val id = item.product?.id ?: return

        lifecycleScope.launch {
            val result =
                if (quantity <= 0) CartStore.remove(id)
                else CartStore.setQuantity(id, quantity)

            when (result) {
                is ApiResult.Ok -> {
                    if (quantity <= 0) toast(getString(R.string.cart_removed))
                    load()
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun confirmClear() {
        AlertDialog.Builder(this)
            .setMessage(R.string.cart_clear_confirm)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.cart_clear) { _, _ ->
                lifecycleScope.launch {
                    CartStore.clear()
                    load()
                }
            }
            .show()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
