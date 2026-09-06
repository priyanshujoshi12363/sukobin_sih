package com.sukobin.officer.ui.main

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sukobin.officer.databinding.ItemAlertBinding
import com.sukobin.officer.databinding.ItemForecastBinding
import com.sukobin.officer.databinding.ItemPendingBinding
import com.sukobin.officer.databinding.ItemRoadBinding
import com.sukobin.officer.R
import com.sukobin.officer.ui.Status

data class AlertRow(
    val alertId: String,
    val severity: String,
    val title: String,
    val body: String,
    val segmentName: String?,
    val kind: String
)

data class RoadRow(
    val segmentId: String,
    val name: String,
    val status: String,
    val statusNote: String?,
    val lengthKm: Double,
    val riskLevel: String,
    val isChokepoint: Boolean,
    val lifelineFor: List<String>,
    val h24: Double?,
    val h48: Double?,
    val h72: Double?,
    val drivers: List<String>,
    val observedSpeedKmph: Double?,
    val baselineSpeedKmph: Double?
)

data class ForecastRow(
    val segmentId: String,
    val name: String,
    val status: String,
    val peak: Double,
    val level: String,
    val firstBreachH: Int,
    val h24: Double?,
    val h48: Double?,
    val h72: Double?,
    val drivers: List<String>,
    val isChokepoint: Boolean,
    val lifelineFor: List<String>
)

data class PendingRow(
    val clientId: String,
    val type: String,
    val severity: String,
    val description: String,
    val segmentName: String?,
    val capturedAt: String,
    val sent: Boolean,
    val attempts: Int,
    val lastError: String?
)

class AlertAdapter(private val onClick: (AlertRow) -> Unit) :
    ListAdapter<AlertRow, AlertAdapter.VH>(diff({ it.alertId })) {

    inner class VH(val b: ItemAlertBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemAlertBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val a = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.alertTitle.text = a.title
        b.alertBody.text = a.body
        b.alertStripe.setBackgroundColor(ContextCompat.getColor(ctx, Status.alertColor(a.severity)))
        b.alertSeverity.text = Status.alertSeverityLabel(ctx, a.severity)
        b.alertSeverity.setTextColor(ContextCompat.getColor(ctx, Status.alertColor(a.severity)))
        b.root.setOnClickListener { onClick(a) }
    }
}

class RoadAdapter(private val onClick: (RoadRow) -> Unit) :
    ListAdapter<RoadRow, RoadAdapter.VH>(diff({ it.segmentId })) {

    inner class VH(val b: ItemRoadBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemRoadBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val r = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.roadName.text = r.name
        b.roadMeta.text = listOfNotNull(
            ctx.getString(R.string.road_km, r.lengthKm.toInt()),
            if (r.isChokepoint) ctx.getString(R.string.road_weak_point) else null,
            if (r.lifelineFor.isNotEmpty())
                ctx.getString(R.string.road_lifeline_for, r.lifelineFor.joinToString(", "))
            else null
        ).joinToString("  ·  ")

        b.statusPill.text = Status.label(ctx, r.status)
        b.statusPill.setBackgroundResource(Status.pillBackground(r.status))

        val peak = listOfNotNull(r.h24, r.h48, r.h72).maxOrNull()
        if (peak == null) {
            b.forecastLine.setText(R.string.forecast_none_yet)
            b.forecastBar.progress = 0
        } else {
            b.forecastLine.text = ctx.getString(
                R.string.forecast_next_three,
                Status.percent(r.h24), Status.percent(r.h48), Status.percent(r.h72)
            )
            b.forecastBar.progress = Math.round(peak * 100).toInt()
        }
        b.forecastBar.progressTintList = android.content.res.ColorStateList.valueOf(
            ContextCompat.getColor(ctx, Status.riskColor(levelOf(peak)))
        )

        val speed = r.observedSpeedKmph
        val base = r.baselineSpeedKmph
        if (speed != null && base != null && base > 0) {
            b.speedLine.visibility = View.VISIBLE
            b.speedLine.text = ctx.getString(R.string.road_speed_now, speed.toInt(), base.toInt())
        } else {
            b.speedLine.visibility = View.GONE
        }

        b.root.setOnClickListener { onClick(r) }
    }
}

class ForecastAdapter(private val onClick: (ForecastRow) -> Unit) :
    ListAdapter<ForecastRow, ForecastAdapter.VH>(diff({ it.segmentId })) {

    inner class VH(val b: ItemForecastBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemForecastBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val f = getItem(position)
        val b = holder.b
        val ctx = b.root.context
        val tint = ContextCompat.getColor(ctx, Status.riskColor(f.level))

        b.roadName.text = f.name
        b.peakValue.text = Status.percent(f.peak)
        b.peakValue.setTextColor(tint)
        b.peakLabel.text = ctx.getString(R.string.forecast_within, f.firstBreachH)

        b.h24Value.text = Status.percent(f.h24)
        b.h48Value.text = Status.percent(f.h48)
        b.h72Value.text = Status.percent(f.h72)

        b.h24Bar.progress = pct(f.h24)
        b.h48Bar.progress = pct(f.h48)
        b.h72Bar.progress = pct(f.h72)
        listOf(b.h24Bar, b.h48Bar, b.h72Bar).forEach {
            it.progressTintList = android.content.res.ColorStateList.valueOf(tint)
        }

        b.whyLine.text = if (f.drivers.isEmpty()) ""
            else ctx.getString(R.string.forecast_why, f.drivers.joinToString(", "))
        b.whyLine.visibility = if (f.drivers.isEmpty()) View.GONE else View.VISIBLE

        val tags = buildList {
            if (f.isChokepoint) add(ctx.getString(R.string.road_weak_point))
            if (f.status == "BLOCKED") add(ctx.getString(R.string.road_already_blocked))
            if (f.lifelineFor.isNotEmpty())
                add(ctx.getString(R.string.road_lifeline_for, f.lifelineFor.joinToString(", ")))
        }
        b.tagLine.text = tags.joinToString("  ·  ")
        b.tagLine.visibility = if (tags.isEmpty()) View.GONE else View.VISIBLE

        b.root.setOnClickListener { onClick(f) }
    }

    private fun pct(v: Double?) = if (v == null) 0 else Math.round(v * 100).toInt()
}

class PendingAdapter : ListAdapter<PendingRow, PendingAdapter.VH>(diff({ it.clientId })) {

    inner class VH(val b: ItemPendingBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemPendingBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val p = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.reportType.text = Status.typeLabel(ctx, p.type)
        b.reportRoad.text = p.segmentName ?: ctx.getString(R.string.road_not_identified)
        b.reportDesc.text = p.description
        b.reportDesc.visibility = if (p.description.isBlank()) View.GONE else View.VISIBLE

        b.severityDot.setBackgroundColor(
            ContextCompat.getColor(ctx, Status.severityColor(p.severity))
        )

        if (p.sent) {
            b.syncState.setText(R.string.queue_sent)
            b.syncState.setTextColor(ContextCompat.getColor(ctx, com.sukobin.core.R.color.status_open))
        } else {
            b.syncState.text = if (p.attempts == 0) ctx.getString(R.string.queue_waiting)
                else ctx.getString(R.string.queue_waiting_tries, p.attempts)
            b.syncState.setTextColor(ContextCompat.getColor(ctx, com.sukobin.core.R.color.status_slow))
        }

        b.errorLine.text = p.lastError.orEmpty()
        b.errorLine.visibility = if (p.lastError.isNullOrBlank() || p.sent) View.GONE else View.VISIBLE
    }
}

private fun levelOf(p: Double?): String = when {
    p == null -> "LOW"
    p >= 0.6 -> "SEVERE"
    p >= 0.35 -> "HIGH"
    p >= 0.15 -> "MODERATE"
    else -> "LOW"
}

private fun <T : Any> diff(key: (T) -> Any) = object : DiffUtil.ItemCallback<T>() {
    override fun areItemsTheSame(a: T, b: T) = key(a) == key(b)
    override fun areContentsTheSame(a: T, b: T) = a == b
}
