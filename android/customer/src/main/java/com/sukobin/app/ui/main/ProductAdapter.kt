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
import kotlin.math.roundToInt

class ProductAdapter(
    private val quantityOf: (Product) -> Int,
    private val onOpen: (Product) -> Unit,
    private val onAdd: (Product) -> Unit,
    private val onChangeQuantity: (Product, Int) -> Unit
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

        b.productCategory.text = p.category.orEmpty()
        b.productName.text = p.productName
        b.productPrice.text = "₹" + p.price.roundToInt()

        val mrp = (p.price * 1.2).roundToInt()
        b.productMrp.text = "₹$mrp"
        b.productMrp.paintFlags =
            b.productMrp.paintFlags or android.graphics.Paint.STRIKE_THRU_TEXT_FLAG

        b.productImage.load(p.thumbnail) { crossfade(true) }

        val shop = p.shop
        if (shop?.shopName != null) {
            b.shopBadge.visibility = View.VISIBLE
            b.shopName.text = shop.shopName
            b.shopLogo.load(shop.shopLogo) { crossfade(true) }
        } else {
            b.shopBadge.visibility = View.GONE
        }

        val available = p.inStock
        b.oosBadge.visibility = if (available) View.GONE else View.VISIBLE
        b.card.alpha = if (available) 1f else 0.6f

        val qty = quantityOf(p)

        when {
            !available -> {
                b.btnAdd.visibility = View.VISIBLE
                b.btnAdd.alpha = 0.35f
                b.btnAdd.isClickable = false
                b.stepper.visibility = View.GONE
            }

            qty > 0 -> {
                b.btnAdd.visibility = View.GONE
                b.stepper.visibility = View.VISIBLE
                b.qty.text = qty.toString()
            }

            else -> {
                b.btnAdd.visibility = View.VISIBLE
                b.btnAdd.alpha = 1f
                b.btnAdd.isClickable = true
                b.stepper.visibility = View.GONE
            }
        }

        b.card.setOnClickListener { onOpen(p) }
        b.btnAdd.setOnClickListener { if (available) onAdd(p) }
        b.btnPlus.setOnClickListener { onChangeQuantity(p, qty + 1) }
        b.btnMinus.setOnClickListener { onChangeQuantity(p, qty - 1) }
    }
}
