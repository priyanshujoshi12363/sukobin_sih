package com.sukobin.merchant.ui.product

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import coil.load
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.Upload
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.ui.Motion
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityEditProductBinding
import kotlinx.coroutines.launch

/**
 * One screen for both adding and editing. Passing a product id switches it to
 * edit; without one it adds. The Expo app had two screens that differed only
 * in whether the fields started full.
 */
class EditProductActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ID = "productId"

        val CATEGORIES = listOf(
            "Groceries", "Vegetables", "Fruits", "Dairy", "Bakery",
            "Medicines", "Stationery", "Household", "Clothing",
            "Electronics", "Hardware", "Other"
        )
    }

    private lateinit var b: ActivityEditProductBinding

    private var productId: String? = null
    private var existingImages: List<String> = emptyList()
    private var newImages = mutableListOf<Uri>()
    private var saving = false

    private val pickImages = registerForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(5)
    ) { uris ->
        if (uris.isNotEmpty()) {
            newImages.clear()
            newImages.addAll(uris)
            renderImages()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityEditProductBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        productId = intent.getStringExtra(EXTRA_ID)

        b.btnBack.setOnClickListener { finish() }
        b.title.setText(if (productId == null) R.string.product_add else R.string.product_edit)
        b.btnSave.setOnClickListener { save() }
        b.btnPickImages.setOnClickListener {
            pickImages.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }

        b.categoryInput.setAdapter(
            ArrayAdapter(this, android.R.layout.simple_list_item_1, CATEGORIES)
        )
        b.categoryInput.setText(CATEGORIES.first(), false)

        if (productId != null) load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { productDetail(productId!!) }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    val p = r.value.decode<Product>("product") ?: return@launch

                    b.nameInput.setText(p.productName)
                    b.descriptionInput.setText(p.description.orEmpty())
                    b.priceInput.setText(p.price.toInt().toString())
                    b.stockInput.setText(p.stock.toString())
                    p.category?.let { b.categoryInput.setText(it, false) }

                    existingImages = p.images
                    renderImages()
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    Toast.makeText(this@EditProductActivity, r.message, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun renderImages() {
        if (newImages.isNotEmpty()) {
            b.imageHint.text = resources.getQuantityString(
                R.plurals.product_images_picked, newImages.size, newImages.size
            )
            b.imagePreview.load(newImages.first()) { crossfade(true) }
            b.imagePreview.visibility = View.VISIBLE
        } else if (existingImages.isNotEmpty()) {
            b.imageHint.setText(R.string.product_images_existing)
            b.imagePreview.load(existingImages.first()) { crossfade(true) }
            b.imagePreview.visibility = View.VISIBLE
        } else {
            b.imageHint.setText(R.string.product_images_none)
            b.imagePreview.visibility = View.GONE
        }
    }

    private fun save() {
        if (saving) return

        val name = b.nameInput.text.toString().trim()
        val category = b.categoryInput.text.toString().trim()
        val priceText = b.priceInput.text.toString().trim()

        if (name.isEmpty()) {
            b.nameLayout.error = getString(R.string.product_need_name)
            return
        }
        b.nameLayout.error = null

        val price = priceText.toDoubleOrNull()
        if (price == null || price < 0) {
            b.priceLayout.error = getString(R.string.product_need_price)
            return
        }
        b.priceLayout.error = null

        saving = true
        b.saveSpinner.visibility = View.VISIBLE
        b.btnSave.isEnabled = false

        val stock = b.stockInput.text.toString().trim().toIntOrNull() ?: 0
        val description = b.descriptionInput.text.toString().trim()
        val parts = Upload.parts(this, newImages, "productImages")

        lifecycleScope.launch {
            val r = if (productId == null) {
                apiCall {
                    createProduct(
                        Upload.text(name),
                        Upload.text(description),
                        Upload.text(category),
                        Upload.text(price.toString()),
                        Upload.text(stock.toString()),
                        parts
                    )
                }
            } else {
                apiCall {
                    editProduct(
                        productId!!,
                        Upload.text(name),
                        Upload.text(description),
                        Upload.text(category),
                        Upload.text(price.toString()),
                        Upload.text(stock.toString()),
                        parts
                    )
                }
            }

            saving = false
            b.saveSpinner.visibility = View.GONE
            b.btnSave.isEnabled = true
            Upload.clearCache(this@EditProductActivity)

            when (r) {
                is ApiResult.Ok -> {
                    Toast.makeText(
                        this@EditProductActivity,
                        getString(if (productId == null) R.string.product_added else R.string.product_updated),
                        Toast.LENGTH_SHORT
                    ).show()
                    finish()
                }

                is ApiResult.Err ->
                    Toast.makeText(this@EditProductActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
