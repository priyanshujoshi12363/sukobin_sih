package com.sukobin.app.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sukobin.app.R
import com.sukobin.app.databinding.FragmentListBinding
import com.sukobin.app.databinding.ItemRecordBinding
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Order
import com.sukobin.core.net.Parcel
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import kotlinx.coroutines.launch

data class Record(
    val ref: String,
    val meta: String,
    val amount: String,
    val status: String
)

class RecordAdapter : ListAdapter<Record, RecordAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Record>() {
            override fun areItemsTheSame(a: Record, b: Record) = a.ref == b.ref
            override fun areContentsTheSame(a: Record, b: Record) = a == b
        }
    }

    inner class VH(val b: ItemRecordBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemRecordBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val r = getItem(position)
        holder.b.recordRef.text = r.ref
        holder.b.recordMeta.text = r.meta
        holder.b.recordAmount.text = r.amount
        holder.b.recordStatus.text = r.status
    }
}

class ListFragment : Fragment() {

    companion object {
        const val ARG_KIND = "kind"
        const val KIND_ORDERS = "orders"
        const val KIND_PARCELS = "parcels"
        const val KIND_HISTORY = "history"

        fun of(kind: String) = ListFragment().apply {
            arguments = Bundle().apply { putString(ARG_KIND, kind) }
        }
    }

    private var _b: FragmentListBinding? = null
    private val b get() = _b!!
    private val adapter = RecordAdapter()

    private val kind: String by lazy {
        arguments?.getString(ARG_KIND) ?: KIND_ORDERS
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentListBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.list.layoutManager = LinearLayoutManager(requireContext())
        b.list.adapter = adapter

        b.listTitle.setText(
            when (kind) {
                KIND_PARCELS -> R.string.tab_parcel
                KIND_HISTORY -> R.string.tab_history
                else -> R.string.tab_orders
            }
        )

        b.refresh.setOnRefreshListener { load() }
        load()
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            val result = when (kind) {
                KIND_PARCELS -> apiCall { myParcels() }
                KIND_HISTORY -> apiCall { orderHistory() }
                else -> apiCall { myOrders() }
            }

            if (_b == null) return@launch
            b.loading.visibility = View.GONE
            b.refresh.isRefreshing = false

            when (result) {
                is ApiResult.Ok -> {
                    val records = if (kind == KIND_PARCELS) {
                        result.value.decodeList<Parcel>("parcels").map {
                            Record(
                                ref = it.parcelId ?: it.id.takeLast(8),
                                meta = listOfNotNull(
                                    it.pickup?.address?.town,
                                    it.drop?.address?.town
                                ).joinToString(" to ").ifBlank { it.pkg?.type ?: "Parcel" },
                                amount = "Rs " + it.totalAmount.toInt(),
                                status = it.status.replace("_", " ")
                            )
                        }
                    } else {
                        result.value.decodeList<Order>("orders").map {
                            Record(
                                ref = it.orderId ?: it.id.takeLast(8),
                                meta = listOfNotNull(
                                    it.shop?.shopName,
                                    it.deliveryAddress?.town
                                ).joinToString("  "),
                                amount = "Rs " + it.totalAmount.toInt(),
                                status = it.status.replace("_", " ")
                            )
                        }
                    }

                    adapter.submitList(records)
                    showEmpty(records.isEmpty(), emptyMessage())
                }

                is ApiResult.Err -> {
                    adapter.submitList(emptyList())
                    showEmpty(true, result.message)
                }
            }
        }
    }

    private fun emptyMessage(): String = getString(
        when (kind) {
            KIND_PARCELS -> R.string.parcels_empty
            KIND_HISTORY -> R.string.history_empty
            else -> R.string.orders_empty
        }
    )

    private fun showEmpty(empty: Boolean, message: String) {
        b.emptyState.visibility = if (empty) View.VISIBLE else View.GONE
        b.list.visibility = if (empty) View.GONE else View.VISIBLE
        b.emptyText.text = message
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
