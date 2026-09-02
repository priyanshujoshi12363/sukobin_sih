package com.sukobin.partner.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.bool
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.partner.R
import com.sukobin.partner.databinding.FragmentStatsBinding
import com.sukobin.partner.databinding.ItemBarBinding
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class StatsFragment : Fragment() {

    private var _b: FragmentStatsBinding? = null
    private val b get() = _b!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentStatsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.refresh.setOnRefreshListener { load() }

        tile(b.tileEarned.root, com.sukobin.core.R.drawable.ic_wallet, R.string.stats_total_earned)
        tile(b.tileTrips.root, com.sukobin.core.R.drawable.ic_truck, R.string.stats_total_trips)
        tile(b.tileDeliveries.root, com.sukobin.core.R.drawable.ic_package, R.string.stats_deliveries)
        tile(b.tileRating.root, com.sukobin.core.R.drawable.ic_star, R.string.stats_rating)

        load()
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun tile(root: View, icon: Int, label: Int) {
        root.findViewById<android.widget.ImageView>(R.id.tileIcon).setImageResource(icon)
        root.findViewById<android.widget.TextView>(R.id.tileLabel).setText(label)
    }

    private fun setTile(root: View, value: String) {
        root.findViewById<android.widget.TextView>(R.id.tileValue).text = value
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        viewLifecycleOwner.lifecycleScope.launch {
            val r = apiCall { partnerStats() }
            if (_b == null) return@launch

            b.loading.visibility = View.GONE
            b.refresh.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> render(r.value)
                is ApiResult.Err -> Unit
            }
        }
    }

    private fun render(body: com.google.gson.JsonObject) {
        val today = body.obj("today")
        val lifetime = body.obj("lifetime")

        b.todayEarnings.text = "₹" + (today?.num("earnings") ?: 0.0).roundToInt()
        b.todayDeliveries.text =
            getString(R.string.stats_today_deliveries, today?.int("deliveries") ?: 0)

        val online = body.bool("isOnline")
        b.onlinePill.setText(if (online) R.string.stats_online else R.string.stats_offline)

        val active = body.int("active", 0)
        b.activePill.visibility = if (active > 0) View.VISIBLE else View.GONE
        if (active > 0) b.activePill.text = getString(R.string.stats_active, active)

        setTile(b.tileEarned.root, "₹" + (lifetime?.num("earnings") ?: 0.0).roundToInt())
        setTile(b.tileTrips.root, (lifetime?.int("trips") ?: 0).toString())
        setTile(b.tileDeliveries.root, (lifetime?.int("deliveries") ?: 0).toString())
        setTile(b.tileRating.root, String.format("%.1f", lifetime?.num("rating") ?: 5.0))

        b.walletBalance.text = "₹" + (lifetime?.num("wallet") ?: 0.0).roundToInt()

        renderWeek(body.arr("weekTrend")?.map { it.asDouble } ?: emptyList())
    }

    private fun renderWeek(values: List<Double>) {
        b.weekChart.removeAllViews()
        if (values.isEmpty()) return

        val max = values.maxOrNull()?.takeIf { it > 0 } ?: 1.0
        val days = listOf("M", "T", "W", "T", "F", "S", "S")
        val maxHeightPx = (72 * resources.displayMetrics.density).toInt()

        values.forEachIndexed { index, value ->
            val bar = ItemBarBinding.inflate(layoutInflater, b.weekChart, false)
            bar.barDay.text = days.getOrElse(index) { "" }
            bar.barValue.text = if (value > 0) value.roundToInt().toString() else ""

            val h = ((value / max) * maxHeightPx).toInt().coerceAtLeast(4)
            bar.bar.layoutParams = LinearLayout.LayoutParams(bar.bar.layoutParams.width, h)
            bar.bar.alpha = if (value > 0) 1f else 0.25f

            b.weekChart.addView(bar.root)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
