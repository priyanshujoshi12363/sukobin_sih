package com.sukobin.app.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.chip.Chip
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityMainBinding
import com.sukobin.app.ui.auth.WelcomeActivity
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.stringList
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private lateinit var adapter: ProductAdapter

    private var activeCategory: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        adapter = ProductAdapter(
            onOpen = { toast(it.productName) },
            onAdd = { addToCart(it) }
        )
        b.productGrid.layoutManager = GridLayoutManager(this, 2)
        b.productGrid.adapter = adapter

        b.deliveryAddress.text = Session.name?.let { "Hi $it" } ?: getString(R.string.home_set_location)

        b.refresh.setOnRefreshListener { loadAll() }
        b.btnRetry.setOnClickListener { loadAll() }

        b.btnProfile.setOnClickListener { signOut() }

        b.inputSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                val q = b.inputSearch.text.toString().trim()
                if (q.isNotEmpty()) search(q) else loadProducts(null)
                true
            } else false
        }

        loadAll()
        refreshCartBadge()
    }

    private fun loadAll() {
        loadCategories()
        loadProducts(activeCategory)
    }

    private fun loadCategories() {
        lifecycleScope.launch {
            when (val r = apiCall { categories() }) {
                is ApiResult.Ok -> renderCategories(r.value.stringList("categories"))
                is ApiResult.Err -> Unit
            }
        }
    }

    private fun renderCategories(categories: List<String>) {
        b.categoryChips.removeAllViews()
        if (categories.isEmpty()) return

        val all = Chip(this).apply {
            text = getString(R.string.home_all_products)
            isCheckable = true
            isChecked = activeCategory == null
            setOnClickListener {
                activeCategory = null
                b.sectionTitle.setText(R.string.home_all_products)
                loadProducts(null)
            }
        }
        b.categoryChips.addView(all)

        for (c in categories) {
            val chip = Chip(this).apply {
                text = c
                isCheckable = true
                isChecked = activeCategory == c
                setOnClickListener {
                    activeCategory = c
                    b.sectionTitle.text = c
                    loadProducts(c)
                }
            }
            b.categoryChips.addView(chip)
        }
    }

    private fun loadProducts(category: String?) {
        setLoading(true)
        lifecycleScope.launch {
            val result = if (category == null) {
                apiCall { allProducts() }
            } else {
                apiCall { productsByCategory(category) }
            }
            handleProducts(result)
        }
    }

    private fun search(query: String) {
        setLoading(true)
        b.sectionTitle.text = "Results for \"$query\""
        lifecycleScope.launch {
            handleProducts(apiCall { searchProducts(query) })
        }
    }

    private fun handleProducts(result: ApiResult<com.google.gson.JsonObject>) {
        setLoading(false)
        b.refresh.isRefreshing = false

        when (result) {
            is ApiResult.Ok -> {
                val products = result.value.decodeList<Product>("products")
                adapter.submitList(products)
                if (products.isEmpty()) {
                    b.emptyState.visibility = View.VISIBLE
                    b.emptyText.text = getString(R.string.home_no_products)
                } else {
                    b.emptyState.visibility = View.GONE
                }
            }

            is ApiResult.Err -> {
                adapter.submitList(emptyList())
                b.emptyState.visibility = View.VISIBLE
                b.emptyText.text = result.message
            }
        }
    }

    private fun addToCart(product: Product) {
        lifecycleScope.launch {
            when (val r = apiCall {
                cartAdd(jsonOf("productId" to product.id, "quantity" to 1))
            }) {
                is ApiResult.Ok -> {
                    toast("${product.productName} added")
                    refreshCartBadge()
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun refreshCartBadge() {
        lifecycleScope.launch {
            when (val r = apiCall { cartSummary() }) {
                is ApiResult.Ok -> {
                    val n = r.value.int("itemCount", 0)
                    b.cartBadge.visibility = if (n > 0) View.VISIBLE else View.GONE
                    b.cartBadge.text = if (n > 9) "9+" else n.toString()
                }

                is ApiResult.Err -> b.cartBadge.visibility = View.GONE
            }
        }
    }

    private fun signOut() {
        Session.clear()
        startActivity(
            Intent(this, WelcomeActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }

    private fun setLoading(value: Boolean) {
        b.loading.visibility = if (value) View.VISIBLE else View.GONE
        if (value) b.emptyState.visibility = View.GONE
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
