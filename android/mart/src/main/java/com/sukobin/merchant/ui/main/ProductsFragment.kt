package com.sukobin.merchant.ui.main

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Product
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.FragmentProductsBinding
import com.sukobin.merchant.ui.product.EditProductActivity
import com.sukobin.merchant.ui.product.ProductDetailActivity
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ProductsFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentProductsBinding? = null
    private val b get() = _b!!

    private var all: List<Product> = emptyList()
    private var searchJob: Job? = null
    private var showOutOfStockOnly = false

    private val adapter = MyProductAdapter(
        onClick = { p ->
            startActivity(
                Intent(requireContext(), ProductDetailActivity::class.java)
                    .putExtra(ProductDetailActivity.EXTRA_ID, p.id)
            )
        },
        onToggle = { p -> toggle(p) }
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentProductsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.productList.layoutManager = LinearLayoutManager(requireContext())
        b.productList.adapter = adapter
        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }

        b.btnAdd.setOnClickListener {
            startActivity(Intent(requireContext(), EditProductActivity::class.java))
        }

        b.chipOutOfStock.setOnCheckedChangeListener { _, checked ->
            showOutOfStockOnly = checked
            apply()
        }

        b.searchInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                // Search server-side once typing settles; filter locally in
                // the meantime so the list never feels frozen.
                apply()
                searchJob?.cancel()
                val q = s?.toString()?.trim().orEmpty()
                if (q.length < 2) return
                searchJob = lifecycleScope.launch {
                    delay(350)
                    when (val r = apiCall { searchMyProducts(q) }) {
                        is ApiResult.Ok -> {
                            if (_b == null) return@launch
                            adapter.submitList(r.value.decodeList<Product>("products"))
                            b.emptyState.visibility =
                                if (adapter.itemCount == 0) View.VISIBLE else View.GONE
                        }
                        is ApiResult.Err -> Unit
                    }
                }
            }

            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
        })

        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun refresh() {
        if (_b == null) return
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            val r = apiCall { myProducts() }
            if (_b == null) return@launch
            b.swipe.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    all = r.value.decodeList("products")
                    apply()
                }
                is ApiResult.Err -> {
                    if (all.isEmpty()) {
                        b.errorState.visibility = View.VISIBLE
                        b.errorText.text = r.message
                    }
                }
            }
        }
    }

    private fun apply() {
        if (_b == null) return
        val q = b.searchInput.text.toString().trim().lowercase()

        val rows = all
            .filter { !showOutOfStockOnly || it.stock <= 0 || !it.isAvailable }
            .filter { q.isEmpty() || it.productName.lowercase().contains(q) }

        adapter.submitList(rows)
        b.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        b.countLine.text = getString(R.string.products_count, rows.size, all.size)
    }

    private fun toggle(product: Product) {
        lifecycleScope.launch {
            when (val r = apiCall { toggleProduct(product.id) }) {
                is ApiResult.Ok -> {
                    all = all.map {
                        if (it.id == product.id) it.copy(isAvailable = !it.isAvailable) else it
                    }
                    apply()
                }
                is ApiResult.Err ->
                    Toast.makeText(requireContext(), r.message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        searchJob?.cancel()
        _b = null
    }
}
