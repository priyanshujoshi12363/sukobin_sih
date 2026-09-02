package com.sukobin.app.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.chip.Chip
import com.google.gson.JsonObject
import com.sukobin.app.R
import com.sukobin.app.databinding.FragmentHomeBinding
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.stringList
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {

    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!

    private lateinit var adapter: ProductAdapter
    private var activeCategory: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentHomeBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        adapter = ProductAdapter(
            onOpen = { toast(it.productName) },
            onAdd = { addToCart(it) }
        )
        b.productGrid.layoutManager = GridLayoutManager(requireContext(), 2)
        b.productGrid.adapter = adapter

        b.refresh.setOnRefreshListener { loadAll() }
        b.btnRetry.setOnClickListener { loadAll() }
        b.btnCart.setOnClickListener { toast(getString(R.string.cart_title)) }

        b.inputSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                val q = b.inputSearch.text.toString().trim()
                if (q.isNotEmpty()) search(q) else loadProducts(activeCategory)
                true
            } else false
        }

        loadAll()
    }

    override fun onResume() {
        super.onResume()
        renderAddress()
        refreshCartBadge()
    }

    private fun renderAddress() {
        b.deliveryAddress.text = Session.address?.takeIf { it.isNotBlank() }
            ?: getString(R.string.home_set_location)
    }

    private fun loadAll() {
        renderAddress()
        loadCategories()
        loadProducts(activeCategory)
        refreshCartBadge()
    }

    private fun loadCategories() {
        lifecycleScope.launch {
            when (val r = apiCall { categories() }) {
                is ApiResult.Ok -> {
                    if (_b != null) renderCategories(r.value.stringList("categories"))
                }

                is ApiResult.Err -> Unit
            }
        }
    }

    private fun renderCategories(categories: List<String>) {
        b.categoryChips.removeAllViews()
        if (categories.isEmpty()) return

        b.categoryChips.addView(Chip(requireContext()).apply {
            text = getString(R.string.home_all_products)
            isCheckable = true
            isChecked = activeCategory == null
            setOnClickListener {
                activeCategory = null
                b.sectionTitle.setText(R.string.home_all_products)
                loadProducts(null)
            }
        })

        for (c in categories) {
            b.categoryChips.addView(Chip(requireContext()).apply {
                text = c
                isCheckable = true
                isChecked = activeCategory == c
                setOnClickListener {
                    activeCategory = c
                    b.sectionTitle.text = c
                    loadProducts(c)
                }
            })
        }
    }

    private fun loadProducts(category: String?) {
        setLoading(true)
        lifecycleScope.launch {
            val result =
                if (category == null) apiCall { allProducts() }
                else apiCall { productsByCategory(category) }
            handleProducts(result)
        }
    }

    private fun search(query: String) {
        setLoading(true)
        b.sectionTitle.text = query
        lifecycleScope.launch { handleProducts(apiCall { searchProducts(query) }) }
    }

    private fun handleProducts(result: ApiResult<JsonObject>) {
        if (_b == null) return
        setLoading(false)
        b.refresh.isRefreshing = false

        when (result) {
            is ApiResult.Ok -> {
                val products = result.value.decodeList<Product>("products")
                adapter.submitList(products)
                b.emptyState.visibility = if (products.isEmpty()) View.VISIBLE else View.GONE
                b.emptyText.text = getString(R.string.home_no_products)
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
                    if (_b == null) return@launch
                    val n = r.value.int("itemCount", 0)
                    b.cartBadge.visibility = if (n > 0) View.VISIBLE else View.GONE
                    b.cartBadge.text = if (n > 9) "9+" else n.toString()
                }

                is ApiResult.Err -> if (_b != null) b.cartBadge.visibility = View.GONE
            }
        }
    }

    private fun setLoading(value: Boolean) {
        b.loading.visibility = if (value) View.VISIBLE else View.GONE
        if (value) b.emptyState.visibility = View.GONE
    }

    private fun toast(msg: String) =
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
