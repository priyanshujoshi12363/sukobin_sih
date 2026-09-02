package com.sukobin.partner.ui.main

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sukobin.core.net.DeliveryJob
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ItemJobBinding
import java.util.Locale

class JobAdapter(
    private val isSelected: (DeliveryJob) -> Boolean,
    private val canSelectMore: () -> Boolean,
    private val onToggle: (DeliveryJob) -> Unit
) : ListAdapter<DeliveryJob, JobAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<DeliveryJob>() {
            override fun areItemsTheSame(a: DeliveryJob, b: DeliveryJob) =
                a.kind == b.kind && a.refId == b.refId

            override fun areContentsTheSame(a: DeliveryJob, b: DeliveryJob) = a == b
        }
    }

    inner class VH(val b: ItemJobBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH =
        VH(ItemJobBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val job = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.jobType.text = job.type?.uppercase(Locale.ROOT) ?: job.kind.uppercase(Locale.ROOT)
        b.jobRef.text = job.refId
        b.jobFee.text = "₹${job.fee.toInt()}"
        b.jobPickup.text = job.pickup?.label ?: "-"
        b.jobDrop.text = job.drop?.label ?: "-"
        b.jobEta.text = ctx.getString(R.string.job_eta, job.etaMin)
        b.jobDetour.text = ctx.getString(
            R.string.job_detour,
            String.format(Locale.ROOT, "%.1f", job.offRouteKm)
        )
        b.jobOrder.text = "#${job.pickupOrder}"

        val selected = isSelected(job)
        b.jobCheck.isChecked = selected
        b.root.alpha = if (!selected && !canSelectMore()) 0.45f else 1f

        b.root.setOnClickListener {
            if (!selected && !canSelectMore()) return@setOnClickListener
            onToggle(job)
        }
    }
}
