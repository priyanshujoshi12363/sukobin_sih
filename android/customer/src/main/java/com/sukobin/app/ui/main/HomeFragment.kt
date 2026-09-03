package com.sukobin.app.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.Toast
import androidx.core.widget.NestedScrollView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.google.android.material.chip.Chip
import com.google.gson.JsonObject
import com.sukobin.app.R
import com.sukobin.app.data.CartStore
import com.sukobin.app.databinding.FragmentHomeBinding
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.obj
import com.sukobin.core.net.stringList
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class HomeFragment : Fragment() {

    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!

    private lateinit var adapter: ProductAdapter

    private var activeCategory: String? = null
    private var currentPage = 1
    private var hasMore = false
    private var loadingMore = false
    private val products = mutableListOf<Product>()

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
            quantityOf = { CartStore.quantityOf(it.id) },
            onOpen = { toast(it.productName) },
            onAdd = { product -> changeQuantity(product, 1) },
            onChangeQuantity = { product, qty -> changeQuantity(product, qty) }
        )

        b.productGrid.layoutManager = GridLayoutManager(requireContext(), 2)
        b.productGrid.adapter = adapter
        b.productGrid.itemAnimator = null

        b.refresh.setOnRefreshListener { reload() }
        b.btnRetry.setOnClickListener { reload() }
        b.btnLoadMore.setOnClickListener { loadMore() }
        b.viewAll.setOnClickListener { selectCategory(null) }

        b.floatingCart.setOnClickListener { openCart() }

        b.inputSearch.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                val q = b.inputSearch.text.toString().trim()
                if (q.isNotEmpty()) search(q) else reload()
                true
            } else false
        }

        parallaxBanner()

        viewLifecycleOwner.lifecycleScope.launch {
            CartStore.state.collectLatest { state ->
                if (_b == null) return@collectLatest
                adapter.notifyDataSetChanged()
                renderFloatingCart(state.itemCount, state.subtotal)
            }
        }

        reload()
    }

    override fun onResume() {
        super.onResume()
        renderAddress()
        viewLifecycleOwner.lifecycleScope.launch { CartStore.refresh() }
    }

    private fun parallaxBanner() {
        b.scroll.setOnScrollChangeListener { _: NestedScrollView, _: Int, y: Int, _: Int, _: Int ->
            if (_b == null) return@setOnScrollChangeListener
            b.banner.translationY = y * 0.4f
            val fade = (1f - (y / 420f)).coerceIn(0f, 1f)
            b.bannerTitle.alpha = fade
            b.bannerSub.alpha = fade
        }
    }

    private fun renderAddress() {
        b.deliveryAddress.text = Session.address?.takeIf { it.isNotBlank() }
            ?: getString(R.string.home_set_location)
    }

    private fun renderFloatingCart(count: Int, subtotal: Double) {
        if (count <= 0) {
            b.floatingCart.visibility = View.GONE
            return
        }
        b.floatingCart.visibility = View.VISIBLE
        val unit = if (count == 1) "item" else "items"
        b.floatingCartText.text = "$count $unit  ·  ₹${subtotal.roundToInt()}"
    }

    private fun changeQuantity(product: Product, quantity: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            val result =
                if (quantity <= 0) CartStore.remove(product.id)
                else if (CartStore.quantityOf(product.id) == 0) CartStore.add(product.id, 1)
                else CartStore.setQuantity(product.id, quantity)

            if (result is ApiResult.Err) toast(result.message)
        }
    }

    private fun selectCategory(category: String?) {
        activeCategory = category
        b.sectionTitle.text = category ?: getString(R.string.home_available_products)
        reload()
    }

    private fun reload() {
        currentPage = 1
        products.clear()
        loadPage(1, reset = true)
    }

    private fun loadMore() {
        if (loadingMore || !hasMore) return
        loadingMore = true
        b.btnLoadMore.setText(R.string.home_loading_products)
        loadPage(currentPage + 1, reset = false)
    }

    private fun loadPage(page: Int, reset: Boolean) {
        if (reset) setLoading(true)

        viewLifecycleOwner.lifecycleScope.launch {
            if (reset) loadCategories()

            val category = activeCategory
            val result =
                if (category == null) apiCall { allProducts(page, 10) }
                else apiCall { productsByCategory(category, page, 10) }

            handleProducts(result, reset)
        }
    }

    private fun search(query: String) {
        setLoading(true)
        b.sectionTitle.text = query
        products.clear()
        viewLifecycleOwner.lifecycleScope.launch {
            handleProducts(apiCall { searchProducts(query) }, reset = true)
        }
    }

    private suspend fun loadCategories() {
        when (val r = apiCall { categories() }) {
            is ApiResult.Ok -> if (_b != null) renderCategories(r.value.stringList("categories"))
            is ApiResult.Err -> Unit
        }
    }

    private fun renderCategories(categories: List<String>) {
        if (b.categoryChips.childCount > 0 && categories.isEmpty()) return
        b.categoryChips.removeAllViews()

        b.categoryChips.addView(chip(getString(R.string.home_all_products), activeCategory == null) {
            selectCategory(null)
        })

        for (c in categories) {
            b.categoryChips.addView(chip(c, activeCategory == c) { selectCategory(c) })
        }
    }

    private fun chip(label: String, active: Boolean, onClick: () -> Unit): Chip =
        Chip(requireContext()).apply {
            text = label
            isCheckable = true
            isChecked = active
            setOnClickListener { onClick() }
        }

    private fun handleProducts(result: ApiResult<JsonObject>, reset: Boolean) {
        if (_b == null) return

        setLoading(false)
        b.refresh.isRefreshing = false
        loadingMore = false
        b.btnLoadMore.setText(R.string.home_load_more)

        when (result) {
            is ApiResult.Ok -> {
                val incoming = result.value.decodeList<Product>("products")
                if (reset) products.clear()
                products.addAll(incoming)
                adapter.submitList(products.toList())

                val pagination = result.value.obj("pagination")
                hasMore = pagination?.get("hasMore")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false
                currentPage = pagination?.get("currentPage")?.takeIf { it.isJsonPrimitive }?.asInt
                    ?: currentPage

                b.btnLoadMore.visibility = if (hasMore) View.VISIBLE else View.GONE
                b.emptyState.visibility = if (products.isEmpty()) View.VISIBLE else View.GONE
                b.emptyText.text = getString(R.string.home_no_products)
            }

            is ApiResult.Err -> {
                if (reset) {
                    adapter.submitList(emptyList())
                    b.emptyState.visibility = View.VISIBLE
                    b.emptyText.text = result.message
                    b.btnLoadMore.visibility = View.GONE
                } else {
                    toast(result.message)
                }
            }
        }
    }

    private fun setLoading(value: Boolean) {
        b.loading.visibility = if (value) View.VISIBLE else View.GONE
        if (value) b.emptyState.visibility = View.GONE
    }

    private fun openCart() {
        startActivity(android.content.Intent(requireContext(), com.sukobin.app.ui.cart.CartActivity::class.java))
    }

    private fun toast(msg: String) =
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
