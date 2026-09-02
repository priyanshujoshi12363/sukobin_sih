package com.sukobin.partner.ui.main

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
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.partner.R
import com.sukobin.partner.databinding.FragmentHistoryBinding
import com.sukobin.partner.databinding.ItemRecordBinding
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

data class Delivery(
    val ref: String,
    val route: String,
    val fee: String,
    val status: String
)

class DeliveryAdapter : ListAdapter<Delivery, DeliveryAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Delivery>() {
            override fun areItemsTheSame(a: Delivery, b: Delivery) = a.ref == b.ref
            override fun areContentsTheSame(a: Delivery, b: Delivery) = a == b
        }
    }

    inner class VH(val b: ItemRecordBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemRecordBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val d = getItem(position)
        holder.b.recordRef.text = d.ref
        holder.b.recordMeta.text = d.route
        holder.b.recordAmount.text = d.fee
        holder.b.recordStatus.text = d.status
    }
}

class HistoryFragment : Fragment() {

    private var _b: FragmentHistoryBinding? = null
    private val b get() = _b!!
    private val adapter = DeliveryAdapter()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentHistoryBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.listTitle.setText(R.string.history_title)
        b.list.layoutManager = LinearLayoutManager(requireContext())
        b.list.adapter = adapter
        b.refresh.setOnRefreshListener { load() }
        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        viewLifecycleOwner.lifecycleScope.launch {
            val r = apiCall { partnerHistory(1) }
            if (_b == null) return@launch

            b.loading.visibility = View.GONE
            b.refresh.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    val items = r.value.arr("items")

                    val list = items?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        Delivery(
                            ref = o.get("refId")?.asString ?: "-",
                            route = o.get("dropLabel")?.asString.orEmpty(),
                            fee = "₹" + (o.get("fee")?.asDouble ?: 0.0).roundToInt(),
                            status = o.get("kind")?.asString?.uppercase() ?: "DELIVERED"
                        )
                    } ?: emptyList()

                    adapter.submitList(list)
                    showEmpty(list.isEmpty(), getString(R.string.history_empty))
                }

                is ApiResult.Err -> {
                    adapter.submitList(emptyList())
                    showEmpty(true, r.message)
                }
            }
        }
    }

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
