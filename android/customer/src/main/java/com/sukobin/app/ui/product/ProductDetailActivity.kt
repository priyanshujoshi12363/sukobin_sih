package com.sukobin.app.ui.product

import android.animation.ObjectAnimator
import android.content.Intent
import android.graphics.Paint
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.core.ui.Motion
import androidx.core.content.ContextCompat
import androidx.core.widget.NestedScrollView
import androidx.lifecycle.lifecycleScope
import coil.load
import com.sukobin.app.R
import com.sukobin.app.data.CartStore
import com.sukobin.app.databinding.ActivityProductDetailBinding
import com.sukobin.app.ui.cart.CartActivity
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class ProductDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PRODUCT_ID = "productId"
    }

    private lateinit var b: ActivityProductDetailBinding

    private var current: Product? = null
    private var quantity = 1
    private var busy = false

    private val productId: String by lazy {
        intent.getStringExtra(EXTRA_PRODUCT_ID).orEmpty()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityProductDetailBinding.inflate(layoutInflater)
        setContentView(b.root)

        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.btnErrorBack.setOnClickListener { finish() }
        b.btnCart.setOnClickListener { startActivity(Intent(this, CartActivity::class.java)) }

        b.btnPlus.setOnClickListener { setQuantity(quantity + 1) }
        b.btnMinus.setOnClickListener { setQuantity(quantity - 1) }
        b.btnAddToCart.setOnClickListener { addToCart() }

        fadeTopBarOnScroll()

        lifecycleScope.launch {
            CartStore.state.collectLatest { renderCartBadge(it.itemCount) }
        }

        load()
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch { CartStore.refresh() }
    }

    private fun fadeTopBarOnScroll() {
        b.scroll.setOnScrollChangeListener { _: NestedScrollView, _: Int, y: Int, _: Int, _: Int ->
            val fade = (1f - (y / 260f)).coerceIn(0f, 1f)
            b.btnBack.alpha = 0.4f + 0.6f * fade
            b.btnCart.alpha = 0.4f + 0.6f * fade
        }
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { product(productId) }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    val p = r.value.decode<Product>("product")
                    if (p == null) showError(getString(R.string.product_not_found)) else render(p)
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    showError(r.message)
                }
            }
        }
    }

    private fun render(p: Product) {
        current = p

        b.content.visibility = View.VISIBLE
        b.bottomBar.visibility = View.VISIBLE

        b.heroImage.load(p.thumbnail) { crossfade(true) }
        b.productName.text = p.productName
        b.productPrice.text = p.price.roundToInt().toString()
        b.categoryBadge.text = p.category ?: getString(R.string.product_title)

        val mrp = (p.price * 1.2).roundToInt()
        b.productMrp.text = "₹$mrp"
        b.productMrp.paintFlags = b.productMrp.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG

        b.productDescription.text =
            p.description?.takeIf { it.isNotBlank() } ?: getString(R.string.product_no_description)

        val available = p.inStock
        b.stockLabel.text =
            if (available) getString(R.string.product_in_stock, p.stock)
            else getString(R.string.common_out_of_stock)

        b.stockLabel.setTextColor(
            ContextCompat.getColor(
                this,
                if (available) com.sukobin.core.R.color.stock_ok
                else com.sukobin.core.R.color.stock_out
            )
        )
        b.stockDot.background = ContextCompat.getDrawable(
            this,
            if (available) com.sukobin.core.R.drawable.bg_circle_green
            else com.sukobin.core.R.drawable.bg_circle_red
        )

        val shop = p.shop
        val hasShop = shop?.shopName != null
        b.shopCard.visibility = if (hasShop) View.VISIBLE else View.GONE
        b.shopChip.visibility = if (hasShop) View.VISIBLE else View.GONE
        b.shopName.text = shop?.shopName.orEmpty()
        b.shopChipName.text = shop?.shopName.orEmpty()
        b.shopAddress.text = shop?.address?.display().orEmpty()
        b.shopLogo.load(shop?.shopLogo) { crossfade(true) }
        b.shopChipLogo.load(shop?.shopLogo) { crossfade(true) }

        b.btnAddToCart.isEnabled = available
        b.btnAddToCart.alpha = if (available) 1f else 0.45f
        b.addLabel.setText(
            if (available) R.string.product_add_to_cart else R.string.common_out_of_stock
        )

        setQuantity(1)
        revealContent()
    }

    private fun revealContent() {
        b.content.alpha = 0f
        b.content.translationY = 26f
        b.content.animate().alpha(1f).translationY(0f).setDuration(320).start()

        b.bottomBar.translationY = 140f
        b.bottomBar.animate().translationY(0f).setDuration(380).setStartDelay(120).start()
    }

    private fun setQuantity(value: Int) {
        val max = current?.stock?.coerceAtLeast(1) ?: 1
        quantity = value.coerceIn(1, max)
        b.qty.text = quantity.toString()

        ObjectAnimator.ofFloat(b.qty, "scaleX", 0.7f, 1f).setDuration(160).start()
        ObjectAnimator.ofFloat(b.qty, "scaleY", 0.7f, 1f).setDuration(160).start()

        val price = current?.price ?: 0.0
        b.addTotal.text = "₹" + (price * quantity).roundToInt()
    }

    private fun addToCart() {
        val p = current ?: return
        if (busy || !p.inStock) return

        setBusy(true)

        lifecycleScope.launch {
            val result = CartStore.add(p.id, quantity)
            setBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    toast(getString(R.string.product_added, p.productName))
                    bumpCart()
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun bumpCart() {
        ObjectAnimator.ofFloat(b.btnCart, "scaleX", 1f, 1.3f, 1f).setDuration(340).start()
        ObjectAnimator.ofFloat(b.btnCart, "scaleY", 1f, 1.3f, 1f).setDuration(340).start()
    }

    private fun renderCartBadge(count: Int) {
        b.cartBadge.visibility = if (count > 0) View.VISIBLE else View.GONE
        b.cartBadge.text = if (count > 9) "9+" else count.toString()
    }

    private fun showError(message: String) {
        b.errorState.visibility = View.VISIBLE
        b.errorText.text = message
        b.content.visibility = View.GONE
        b.bottomBar.visibility = View.GONE
    }

    private fun setBusy(value: Boolean) {
        busy = value
        b.addSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnAddToCart.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
