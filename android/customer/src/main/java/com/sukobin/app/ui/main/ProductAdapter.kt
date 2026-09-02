package com.sukobin.app.ui.main

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.sukobin.app.databinding.ItemProductBinding
import com.sukobin.core.net.Product

class ProductAdapter(
    private val onOpen: (Product) -> Unit,
    private val onAdd: (Product) -> Unit
) : ListAdapter<Product, ProductAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Product>() {
            override fun areItemsTheSame(a: Product, b: Product) = a.id == b.id
            override fun areContentsTheSame(a: Product, b: Product) = a == b
        }
    }

    inner class VH(val b: ItemProductBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(ItemProductBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = getItem(position)
        val b = holder.b

        b.productName.text = p.productName
        b.productShop.text = p.shop?.shopName ?: ""
        b.productPrice.text = "Rs ${p.price.toInt()}"

        b.productImage.load(p.thumbnail) {
            crossfade(true)
        }

        b.outOfStock.visibility = if (p.inStock) View.GONE else View.VISIBLE
        b.btnAdd.alpha = if (p.inStock) 1f else 0.4f
        b.btnAdd.isEnabled = p.inStock

        b.root.setOnClickListener { onOpen(p) }
        b.btnAdd.setOnClickListener { if (p.inStock) onAdd(p) }
    }
}
