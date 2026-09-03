package com.sukobin.merchant.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Merchant
import com.sukobin.core.net.Order
import com.sukobin.core.net.Product
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityMainBinding
import com.sukobin.merchant.ui.auth.WelcomeActivity
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private val orderAdapter = OrderAdapter()
    private val productAdapter = MyProductAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.greeting.text = getString(R.string.home_greeting, Session.name ?: "there")

        b.orderList.layoutManager = LinearLayoutManager(this)
        b.orderList.adapter = orderAdapter
        b.productList.layoutManager = LinearLayoutManager(this)
        b.productList.adapter = productAdapter

        b.refresh.setOnRefreshListener { loadAll() }
        b.btnSignOut.setOnClickListener { signOut() }

        loadAll()
    }

    private fun loadAll() {
        b.errorLine.visibility = View.GONE
        loadProfile()
        loadStats()
        loadOrders()
        loadProducts()
    }

    private fun loadProfile() {
        lifecycleScope.launch {
            when (val r = apiCall { merchantMe() }) {
                is ApiResult.Ok -> {
                    val m = r.value.decode<Merchant>("merchant")
                    if (m?.name != null) {
                        Session.name = m.name
                        b.greeting.text = getString(R.string.home_greeting, m.name)
                    }
                    b.shopLine.text = m?.phone ?: ""
                }

                is ApiResult.Err -> showError(r.message)
            }
        }
    }

    private fun loadStats() {
        lifecycleScope.launch {
            when (val r = apiCall { merchantStats() }) {
                is ApiResult.Ok -> {
                    val d = r.value
                    val today = d.obj("today")
                    val totals = d.obj("totals")

                    b.todayRevenue.text = "₹" + (today?.num("revenue") ?: 0.0).toInt()
                    b.todayOrders.text = (today?.int("orders") ?: 0).toString() + " orders today"
                    b.newOrders.text = d.int("newOrders", 0).toString()

                    b.totalRevenue.text = "₹" + (totals?.num("revenue") ?: 0.0).toInt()
                    b.totalOrders.text = (totals?.int("orders") ?: 0).toString()
                    b.itemsSold.text = (totals?.int("itemsSold") ?: 0).toString()
                }

                is ApiResult.Err -> showError(r.message)
            }
        }
    }

    private fun loadOrders() {
        lifecycleScope.launch {
            val r = apiCall { merchantOrders() }
            b.refresh.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    val orders = r.value.decodeList<Order>("orders")
                    orderAdapter.submitList(orders.take(10))
                    b.noOrders.visibility = if (orders.isEmpty()) View.VISIBLE else View.GONE
                }

                is ApiResult.Err -> {
                    b.noOrders.visibility = View.VISIBLE
                    showError(r.message)
                }
            }
        }
    }

    private fun loadProducts() {
        lifecycleScope.launch {
            when (val r = apiCall { myProducts() }) {
                is ApiResult.Ok -> {
                    val products = r.value.decodeList<Product>("products")
                    productAdapter.submitList(products)
                    b.noProducts.visibility = if (products.isEmpty()) View.VISIBLE else View.GONE
                }

                is ApiResult.Err -> b.noProducts.visibility = View.VISIBLE
            }
        }
    }

    private fun showError(message: String) {
        b.errorLine.visibility = View.VISIBLE
        b.errorLine.text = message
    }

    private fun signOut() {
        Session.clear()
        startActivity(
            Intent(this, WelcomeActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }
}
