package com.sukobin.merchant.ui.main

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.FragmentAnalyticsBinding
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class AnalyticsFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentAnalyticsBinding? = null
    private val b get() = _b!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentAnalyticsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }
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
            val r = apiCall { merchantStats() }
            if (_b == null) return@launch
            b.swipe.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> render(r.value)
                is ApiResult.Err -> {
                    b.errorState.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun render(data: JsonObject) {
        val totals = data.obj("totals")
        val today = data.obj("today")

        b.totalRevenue.text = "₹" + (totals?.num("revenue") ?: 0.0).toInt()
        b.totalOrders.text = (totals?.int("orders") ?: 0).toString()
        b.itemsSold.text = (totals?.int("itemsSold") ?: 0).toString()
        b.todayRevenue.text = "₹" + (today?.num("revenue") ?: 0.0).toInt()
        b.todayOrders.text = (today?.int("orders") ?: 0).toString()

        renderWeek(data)
        renderStatuses(data.obj("statusCounts"))
        renderTopProducts(data)
    }

    /**
     * A seven-bar chart drawn from plain views. A charting library would be a
     * megabyte for one screen.
     */
    private fun renderWeek(data: JsonObject) {
        b.weekChart.removeAllViews()

        val week = data.arr("weekTrend")?.mapNotNull { it as? JsonObject } ?: emptyList()
        if (week.isEmpty()) {
            b.weekEmpty.visibility = View.VISIBLE
            return
        }
        b.weekEmpty.visibility = View.GONE

        val values = week.map { it.get("revenue")?.asDouble ?: 0.0 }
        val peak = values.maxOrNull() ?: 0.0
        val density = resources.displayMetrics.density
        val maxBarPx = (110 * density).toInt()

        week.forEachIndexed { i, day ->
            val revenue = values[i]
            val column = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
            }

            val amount = TextView(requireContext()).apply {
                text = if (revenue > 0) "₹" + revenue.roundToInt() else ""
                textSize = 9f
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_500))
                gravity = Gravity.CENTER
            }

            val bar = View(requireContext()).apply {
                val height = if (peak <= 0) 2 else maxOf((revenue / peak * maxBarPx).toInt(), 2)
                layoutParams = LinearLayout.LayoutParams((18 * density).toInt(), height).apply {
                    topMargin = (4 * density).toInt()
                    bottomMargin = (6 * density).toInt()
                }
                setBackgroundColor(
                    ContextCompat.getColor(
                        requireContext(),
                        if (revenue > 0) com.sukobin.core.R.color.accent_green
                        else com.sukobin.core.R.color.gray_200
                    )
                )
            }

            val label = TextView(requireContext()).apply {
                // "2026-09-05" -> "05/09"
                val d = day.get("date")?.asString.orEmpty()
                text = if (d.length >= 10) d.substring(8, 10) + "/" + d.substring(5, 7) else ""
                textSize = 9f
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_400))
                gravity = Gravity.CENTER
            }

            column.addView(amount)
            column.addView(bar)
            column.addView(label)
            b.weekChart.addView(column)
        }
    }

    private fun renderStatuses(counts: JsonObject?) {
        b.statusList.removeAllViews()
        if (counts == null || counts.size() == 0) {
            b.statusEmpty.visibility = View.VISIBLE
            return
        }
        b.statusEmpty.visibility = View.GONE

        val density = resources.displayMetrics.density
        for ((status, value) in counts.entrySet()) {
            val row = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, (6 * density).toInt(), 0, (6 * density).toInt())
            }

            row.addView(TextView(requireContext()).apply {
                text = status.replace("_", " ").lowercase()
                    .replaceFirstChar { it.uppercase() }
                textSize = 13f
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_700))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })

            row.addView(TextView(requireContext()).apply {
                text = value.asString
                textSize = 13f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_800))
            })

            b.statusList.addView(row)
        }
    }

    private fun renderTopProducts(data: JsonObject) {
        b.topList.removeAllViews()

        val top = data.arr("topProducts")?.mapNotNull { it as? JsonObject } ?: emptyList()
        if (top.isEmpty()) {
            b.topEmpty.visibility = View.VISIBLE
            return
        }
        b.topEmpty.visibility = View.GONE

        val density = resources.displayMetrics.density
        top.forEachIndexed { i, p ->
            val row = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, (8 * density).toInt(), 0, (8 * density).toInt())
            }

            row.addView(TextView(requireContext()).apply {
                text = (i + 1).toString()
                textSize = 12f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.accent_green))
                width = (22 * density).toInt()
            })

            row.addView(TextView(requireContext()).apply {
                text = p.get("name")?.asString ?: "-"
                textSize = 13f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_800))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })

            row.addView(TextView(requireContext()).apply {
                text = getString(R.string.analytics_sold, p.get("qty")?.asInt ?: 0)
                textSize = 11f
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_500))
                setPadding((8 * density).toInt(), 0, (8 * density).toInt(), 0)
            })

            row.addView(TextView(requireContext()).apply {
                text = "₹" + (p.get("revenue")?.asInt ?: 0)
                textSize = 13f
                setTypeface(null, android.graphics.Typeface.BOLD)
                setTextColor(ContextCompat.getColor(requireContext(), com.sukobin.core.R.color.gray_800))
            })

            b.topList.addView(row)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
