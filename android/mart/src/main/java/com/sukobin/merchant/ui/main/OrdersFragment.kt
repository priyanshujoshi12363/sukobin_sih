package com.sukobin.merchant.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.chip.Chip
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Order
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.FragmentOrdersBinding
import com.sukobin.merchant.ui.order.OrderDetailActivity
import kotlinx.coroutines.launch

class OrdersFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentOrdersBinding? = null
    private val b get() = _b!!

    // Maps a chip to the statuses the API should return. "Needs you" is the
    // default because it is the only tab a shopkeeper must act on.
    private var filter: String? = "PLACED"

    private val adapter = OrderAdapter { order ->
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
        _b = FragmentOrdersBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.orderList.layoutManager = LinearLayoutManager(requireContext())
        b.orderList.adapter = adapter
        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }

        b.filterGroup.setOnCheckedStateChangeListener { group, ids ->
            filter = when (ids.firstOrNull()) {
                R.id.chip_new -> "PLACED"
                R.id.chip_working -> "ACCEPTED,PREPARING"
                R.id.chip_ready -> "READY_FOR_PICKUP,PICKED,ON_THE_WAY"
                R.id.chip_done -> "DELIVERED"
                R.id.chip_cancelled -> "CANCELLED"
                else -> null
            }
            refresh()
        }

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
            val r = apiCall { merchantOrdersFiltered(status = filter, limit = 50) }
            if (_b == null) return@launch
            b.swipe.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    val list = r.value.decodeList<Order>("orders")
                    adapter.submitList(list)
                    b.emptyState.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
                    b.countLine.text = resources.getQuantityString(
                        R.plurals.orders_count, list.size, list.size
                    )
                    if (filter == "PLACED") {
                        (activity as? MainActivity)?.setOrderBadge(list.size)
                    }
                }

                is ApiResult.Err -> {
                    b.errorState.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
