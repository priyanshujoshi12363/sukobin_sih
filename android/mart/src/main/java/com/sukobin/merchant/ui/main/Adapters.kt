package com.sukobin.merchant.ui.main

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.sukobin.core.net.Order
import com.sukobin.core.net.Product
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ItemMyProductBinding
import com.sukobin.merchant.databinding.ItemOrderBinding

class OrderAdapter : ListAdapter<Order, OrderAdapter.VH>(DIFF) {

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

        b.orderRef.text = o.orderId ?: o.id.takeLast(8)
        b.orderMeta.text = listOfNotNull(
            o.deliveryAddress?.town ?: o.deliveryAddress?.district,
            o.paymentMethod
        ).joinToString("   ")
        b.orderAmount.text = "₹" + o.totalAmount.toInt()
        b.orderStatus.text = o.status.replace("_", " ")
    }
}

class MyProductAdapter : ListAdapter<Product, MyProductAdapter.VH>(DIFF) {

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
        ).joinToString("   ")
        b.productPrice.text = "₹" + p.price.toInt()
        b.productImage.load(p.thumbnail) { crossfade(true) }
    }
}
