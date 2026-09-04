package com.sukobin.officer.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.officer.databinding.FragmentForecastBinding
import kotlinx.coroutines.launch

class ForecastFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentForecastBinding? = null
    private val b get() = _b!!

    private val adapter = ForecastAdapter { row ->
        startActivity(
            Intent(requireContext(), RoadDetailActivity::class.java)
                .putExtra(RoadDetailActivity.EXTRA_SEGMENT_ID, row.segmentId)
                .putExtra(RoadDetailActivity.EXTRA_NAME, row.name)
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentForecastBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.forecastList.layoutManager = LinearLayoutManager(requireContext())
        b.forecastList.adapter = adapter
        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }
        refresh()
    }

    override fun refresh() {
        if (_b == null) return
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { officerForecast(0.15) }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    render(r.value)
                }

                is ApiResult.Err -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    b.errorState.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun render(data: JsonObject) {
        val rows = data.arr("upcoming")?.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            ForecastRow(
                segmentId = o.get("segmentId")?.asString ?: return@mapNotNull null,
                name = o.get("name")?.asString.orEmpty(),
                status = o.get("status")?.asString ?: "UNKNOWN",
                peak = o.get("peakProbability")?.asDouble ?: 0.0,
                level = o.get("level")?.asString ?: "LOW",
                firstBreachH = o.get("firstBreachH")?.asInt ?: 72,
                h24 = o.get("h24")?.takeIf { !it.isJsonNull }?.asDouble,
                h48 = o.get("h48")?.takeIf { !it.isJsonNull }?.asDouble,
                h72 = o.get("h72")?.takeIf { !it.isJsonNull }?.asDouble,
                drivers = o.getAsJsonArray("drivers")?.mapNotNull {
                    (it as? JsonObject)?.get("factor")?.asString
                }.orEmpty(),
                isChokepoint = o.get("isChokepoint")?.takeIf { !it.isJsonNull }?.asBoolean ?: false,
                lifelineFor = o.getAsJsonArray("lifelineFor")?.mapNotNull { it.asString }.orEmpty()
            )
        }.orEmpty()

        adapter.submitList(rows)
        b.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        b.headline.text = if (rows.isEmpty()) {
            "Nothing looks likely to close in the next three days"
        } else {
            "${rows.size} ${if (rows.size == 1) "road needs" else "roads need"} watching over the next three days"
        }

        val model = data.obj("model")
        if (model?.get("available")?.asBoolean == true) {
            val dataset = model.obj("dataset")
            val metrics = model.obj("metrics")
            b.modelCard.visibility = View.VISIBLE
            b.modelName.text = if (model.str("chosen") == "gbt") {
                "Boosted decision trees"
            } else {
                "Logistic regression"
            }
            b.modelTrained.text = "Trained on ${fmt(dataset?.int("rows") ?: 0)} road-days of real past weather across ${dataset?.int("segments") ?: 0} stretches"
            b.modelScore.text = "Ranking accuracy ${String.format("%.3f", metrics?.num("auc") ?: 0.0)}  ·  average error ${String.format("%.3f", metrics?.num("brier") ?: 0.0)}"

            val importance = data.arr("importance")?.mapNotNull {
                val o = it as? JsonObject ?: return@mapNotNull null
                (o.get("label")?.asString ?: "") to (o.get("weight")?.asDouble ?: 0.0)
            }.orEmpty()

            b.modelFactors.text = importance.take(4).joinToString("\n") { (label, w) ->
                "  ${Math.round(w * 100)}%   $label"
            }
        } else {
            b.modelCard.visibility = View.GONE
        }
    }

    private fun fmt(n: Int) = String.format("%,d", n)

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
