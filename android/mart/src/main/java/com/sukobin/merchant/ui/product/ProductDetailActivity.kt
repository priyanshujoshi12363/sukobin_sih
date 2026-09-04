package com.sukobin.merchant.ui.product

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.ui.Motion
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityProductDetailBinding
import kotlinx.coroutines.launch

class ProductDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ID = "productId"
    }

    private lateinit var b: ActivityProductDetailBinding
    private var id: String = ""
    private var product: Product? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityProductDetailBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        id = intent.getStringExtra(EXTRA_ID).orEmpty()

        b.btnBack.setOnClickListener { finish() }
        b.btnEdit.setOnClickListener {
            startActivity(
                Intent(this, EditProductActivity::class.java)
                    .putExtra(EditProductActivity.EXTRA_ID, id)
            )
        }
        b.btnToggle.setOnClickListener { toggle() }
        b.btnDelete.setOnClickListener { confirmDelete() }

        load()
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { productDetail(id) }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    product = r.value.decode("product")
                    product?.let { render(it) }
                }
                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    b.errorText.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun render(p: Product) {
        b.content.visibility = View.VISIBLE
        b.productName.text = p.productName
        b.productPrice.text = "₹" + p.price.toInt()
        b.productCategory.text = p.category.orEmpty()
        b.productDescription.text = p.description.orEmpty()
        b.productDescription.visibility =
            if (p.description.isNullOrBlank()) View.GONE else View.VISIBLE

        b.productStock.text = getString(R.string.product_in_stock, p.stock)
        b.productImage.load(p.thumbnail) { crossfade(true) }

        val live = p.isAvailable && p.isActive
        b.availabilityPill.text = getString(
            if (live) R.string.product_listed else R.string.product_hidden
        )
        b.availabilityPill.setBackgroundResource(
            if (live) R.drawable.bg_pill_live else R.drawable.bg_pill_hidden
        )
        b.btnToggle.text = getString(
            if (live) R.string.product_hide else R.string.product_show
        )

        b.ratingLine.text = getString(R.string.product_rating, p.ratings, p.totalReviews)
        b.ratingLine.visibility = if (p.totalReviews > 0) View.VISIBLE else View.GONE
    }

    private fun toggle() {
        lifecycleScope.launch {
            when (val r = apiCall { toggleProduct(id) }) {
                is ApiResult.Ok -> load()
                is ApiResult.Err ->
                    Toast.makeText(this@ProductDetailActivity, r.message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun confirmDelete() {
        AlertDialog.Builder(this)
            .setTitle(R.string.product_delete_title)
            .setMessage(getString(R.string.product_delete_body, product?.productName.orEmpty()))
            .setNegativeButton(R.string.common_cancel, null)
            .setPositiveButton(R.string.product_delete) { _, _ ->
                lifecycleScope.launch {
                    when (val r = apiCall { deleteProduct(id) }) {
                        is ApiResult.Ok -> {
                            Toast.makeText(
                                this@ProductDetailActivity,
                                getString(R.string.product_deleted),
                                Toast.LENGTH_SHORT
                            ).show()
                            finish()
                        }
                        is ApiResult.Err ->
                            Toast.makeText(this@ProductDetailActivity, r.message, Toast.LENGTH_LONG).show()
                    }
                }
            }
            .show()
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
