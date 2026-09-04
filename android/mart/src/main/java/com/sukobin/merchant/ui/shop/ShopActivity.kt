package com.sukobin.merchant.ui.shop

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Shop
import com.sukobin.core.net.Upload
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.core.ui.Motion
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityShopBinding
import kotlinx.coroutines.launch

/**
 * Create the shop, or edit the one that exists. Which of the two it is depends
 * only on whether the merchant already has one, so this is one screen rather
 * than the two the Expo app used.
 */
class ShopActivity : AppCompatActivity() {

    companion object {
        val CATEGORIES = listOf(
            "Grocery", "Pharmacy", "Bakery", "Vegetables and fruit",
            "Stationery", "Hardware", "Clothing", "Electronics",
            "Restaurant", "General store", "Other"
        )
    }

    private lateinit var b: ActivityShopBinding

    private var shopId: String? = null
    private var logoUri: Uri? = null
    private var existingLogo: String? = null
    private var saving = false

    private val pickLogo = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            logoUri = uri
            b.logoPreview.visibility = View.VISIBLE
            b.logoPreview.load(uri) { crossfade(true) }
            b.logoHint.setText(R.string.shop_logo_picked)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityShopBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.btnSave.setOnClickListener { save() }
        b.btnPickLogo.setOnClickListener {
            pickLogo.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }

        b.categoryInput.setAdapter(
            ArrayAdapter(this, android.R.layout.simple_list_item_1, CATEGORIES)
        )
        b.categoryInput.setText(CATEGORIES.first(), false)

        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { myShops() }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    val shop = r.value.decodeList<Shop>("shops").firstOrNull()
                        ?: r.value.decode<Shop>("shop")

                    if (shop == null) {
                        b.title.setText(R.string.shop_create)
                        b.intro.setText(R.string.shop_create_intro)
                    } else {
                        shopId = shop.id
                        b.title.setText(R.string.shop_manage)
                        b.intro.setText(R.string.shop_manage_intro)

                        b.nameInput.setText(shop.shopName.orEmpty())
                        b.phoneInput.setText(shop.phoneNumber.orEmpty())
                        b.addressInput.setText(shop.address?.display().orEmpty())

                        existingLogo = shop.shopLogo
                        if (!existingLogo.isNullOrBlank()) {
                            b.logoPreview.visibility = View.VISIBLE
                            b.logoPreview.load(existingLogo) { crossfade(true) }
                            b.logoHint.setText(R.string.shop_logo_existing)
                        }
                    }
                    b.content.visibility = View.VISIBLE
                }

                is ApiResult.Err -> {
                    // No shop yet is the normal first-run case, not an error.
                    b.loading.visibility = View.GONE
                    b.content.visibility = View.VISIBLE
                    b.title.setText(R.string.shop_create)
                    b.intro.setText(R.string.shop_create_intro)
                }
            }
        }
    }

    private fun save() {
        if (saving) return

        val name = b.nameInput.text.toString().trim()
        if (name.isEmpty()) {
            b.nameLayout.error = getString(R.string.shop_need_name)
            return
        }
        b.nameLayout.error = null

        val phone = b.phoneInput.text.toString().trim()
        val address = b.addressInput.text.toString().trim()
        val category = b.categoryInput.text.toString().trim()
        val description = b.descriptionInput.text.toString().trim()

        saving = true
        b.saveSpinner.visibility = View.VISIBLE
        b.btnSave.isEnabled = false

        val logoPart = logoUri?.let { Upload.part(this, it, "shopLogo") }

        lifecycleScope.launch {
            val r = if (shopId == null) {
                apiCall {
                    createShop(
                        Upload.text(name),
                        Upload.text(description),
                        Upload.text(category),
                        Upload.text(phone),
                        Upload.text(address),
                        // The server accepts a coordinate pair; without a map
                        // picker yet it geocodes from the address instead.
                        Upload.text(""),
                        logoPart
                    )
                }
            } else {
                apiCall {
                    editShop(
                        shopId!!,
                        Upload.text(name),
                        Upload.text(description),
                        Upload.text(category),
                        Upload.text(phone),
                        Upload.text(address),
                        logoPart
                    )
                }
            }

            saving = false
            b.saveSpinner.visibility = View.GONE
            b.btnSave.isEnabled = true
            Upload.clearCache(this@ShopActivity)

            when (r) {
                is ApiResult.Ok -> {
                    Toast.makeText(
                        this@ShopActivity,
                        getString(if (shopId == null) R.string.shop_created else R.string.shop_updated),
                        Toast.LENGTH_SHORT
                    ).show()
                    finish()
                }

                is ApiResult.Err ->
                    Toast.makeText(this@ShopActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
