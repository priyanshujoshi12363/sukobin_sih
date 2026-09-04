package com.sukobin.merchant.ui.main

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.sukobin.core.net.Order
import com.sukobin.core.net.Product
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ItemMyProductBinding
import com.sukobin.merchant.databinding.ItemOrderBinding
import kotlin.math.roundToInt

class OrderAdapter(
    private val onClick: (Order) -> Unit = {}
) : ListAdapter<Order, OrderAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Order>() {
            override fun areItemsTheSame(a: Order, b: Order) = a.id == b.id
            override fun areContentsTheSame(a: Order, b: Order) = a == b
        }
    }

    inner class VH(val b: ItemOrderBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemOrderBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val o = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.orderRef.text = o.orderId ?: o.id.takeLast(8)
        b.orderMeta.text = listOfNotNull(
            o.deliveryAddress?.town ?: o.deliveryAddress?.district,
            o.paymentMethod,
            ctx.resources.getQuantityString(R.plurals.order_items, o.items.size, o.items.size)
        ).joinToString("  ·  ")

        b.orderAmount.text = "₹" + o.totalAmount.roundToInt()
        b.orderStatus.text = o.status.replace("_", " ")
        b.orderStatus.setBackgroundResource(
            when (o.status) {
                "PLACED" -> R.drawable.bg_pill_new
                "CANCELLED" -> R.drawable.bg_pill_hidden
                "DELIVERED" -> R.drawable.bg_pill_live
                else -> R.drawable.bg_pill_working
            }
        )

        b.root.setOnClickListener { onClick(o) }
    }
}

class MyProductAdapter(
    private val onClick: (Product) -> Unit = {},
    private val onToggle: (Product) -> Unit = {}
) : ListAdapter<Product, MyProductAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Product>() {
            override fun areItemsTheSame(a: Product, b: Product) = a.id == b.id
            override fun areContentsTheSame(a: Product, b: Product) = a == b
        }
    }

    inner class VH(val b: ItemMyProductBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemMyProductBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.productName.text = p.productName
        b.productMeta.text = listOfNotNull(
            p.category,
            ctx.getString(R.string.home_stock, p.stock)
        ).joinToString("  ·  ")
        b.productPrice.text = "₹" + p.price.roundToInt()
        b.productImage.load(p.thumbnail) { crossfade(true) }

        // A hidden or out-of-stock line is the shopkeeper's problem to spot at
        // a glance, so it is dimmed and flagged rather than looking normal.
        val live = p.isAvailable && p.isActive
        b.stockWarning.visibility = if (p.stock <= 0) View.VISIBLE else View.GONE
        b.root.alpha = if (live) 1f else 0.55f

        b.btnToggle.text = ctx.getString(
            if (live) R.string.product_hide else R.string.product_show
        )
        b.btnToggle.setTextColor(
            ContextCompat.getColor(
                ctx,
                if (live) com.sukobin.core.R.color.gray_600 else com.sukobin.core.R.color.accent_green
            )
        )
        b.btnToggle.setOnClickListener { onToggle(p) }
        b.root.setOnClickListener { onClick(p) }
    }
}
