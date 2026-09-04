package com.sukobin.merchant.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Merchant
import com.sukobin.core.net.Order
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.FragmentHomeBinding
import com.sukobin.merchant.ui.order.OrderDetailActivity
import com.sukobin.merchant.ui.product.EditProductActivity
import com.sukobin.merchant.ui.shop.ShopActivity
import kotlinx.coroutines.launch

/** What the shopkeeper needs to act on first thing in the morning. */
class HomeFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!

    private val orders = OrderAdapter { order ->
        startActivity(
            Intent(requireContext(), OrderDetailActivity::class.java)
                .putExtra(OrderDetailActivity.EXTRA_ID, order.orderId ?: order.id)
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentHomeBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.orderList.layoutManager = LinearLayoutManager(requireContext())
        b.orderList.adapter = orders
        b.orderList.isNestedScrollingEnabled = false

        b.refresh.setOnRefreshListener { refresh() }

        b.btnAddProduct.setOnClickListener {
            startActivity(Intent(requireContext(), EditProductActivity::class.java))
        }
        b.btnManageShop.setOnClickListener {
            startActivity(Intent(requireContext(), ShopActivity::class.java))
        }
        b.btnAllOrders.setOnClickListener {
            (activity as? MainActivity)?.openTab(R.id.tab_orders)
        }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun refresh() {
        if (_b == null) return
        b.errorLine.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { merchantMe() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val m = r.value.decode<Merchant>("merchant")
                    m?.name?.let { Session.name = it }
                    b.greeting.text = getString(R.string.home_greeting, Session.name ?: "there")
                    b.shopLine.text = m?.phone.orEmpty()
                }
                is ApiResult.Err -> showError(r.message)
            }
        }

        lifecycleScope.launch {
            when (val r = apiCall { merchantStats() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val today = r.value.obj("today")
                    val totals = r.value.obj("totals")

                    b.todayRevenue.text = "₹" + (today?.num("revenue") ?: 0.0).toInt()
                    b.todayOrders.text = getString(R.string.home_orders_today, today?.int("orders") ?: 0)

                    val waiting = r.value.int("newOrders")
                    b.newOrders.text = waiting.toString()
                    b.newOrdersCard.visibility = if (waiting > 0) View.VISIBLE else View.GONE
                    (activity as? MainActivity)?.setOrderBadge(waiting)

                    b.totalRevenue.text = "₹" + (totals?.num("revenue") ?: 0.0).toInt()
                    b.totalOrders.text = (totals?.int("orders") ?: 0).toString()
                    b.itemsSold.text = (totals?.int("itemsSold") ?: 0).toString()
                }
                is ApiResult.Err -> showError(r.message)
            }
        }

        lifecycleScope.launch {
            val r = apiCall { merchantOrdersFiltered(limit = 8) }
            if (_b == null) return@launch
            b.refresh.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    val list = r.value.decodeList<Order>("orders")
                    orders.submitList(list.take(8))
                    b.noOrders.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                }
                is ApiResult.Err -> {
                    b.noOrders.visibility = View.VISIBLE
                    showError(r.message)
                }
            }
        }
    }

    private fun showError(message: String) {
        if (_b == null) return
        b.errorLine.visibility = View.VISIBLE
        b.errorLine.text = message
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
