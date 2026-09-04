package com.sukobin.officer.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.chip.Chip
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.apiCall as call
import com.sukobin.officer.databinding.FragmentRoadsBinding
import kotlinx.coroutines.launch

class RoadsFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentRoadsBinding? = null
    private val b get() = _b!!

    private var all: List<RoadRow> = emptyList()
    private var filter: String? = null

    private val adapter = RoadAdapter { road ->
        startActivity(
            Intent(requireContext(), RoadDetailActivity::class.java)
                .putExtra(RoadDetailActivity.EXTRA_SEGMENT_ID, road.segmentId)
                .putExtra(RoadDetailActivity.EXTRA_NAME, road.name)
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentRoadsBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.roadList.layoutManager = LinearLayoutManager(requireContext())
        b.roadList.adapter = adapter

        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }

        b.filterGroup.setOnCheckedStateChangeListener { group, ids ->
            val chip = ids.firstOrNull()?.let { group.findViewById<Chip>(it) }
            filter = when (chip?.text?.toString()) {
                "Blocked" -> "BLOCKED"
                "Difficult" -> "DIFFICULT"
                "Weak points" -> "CHOKEPOINT"
                "At risk" -> "RISK"
                else -> null
            }
            apply()
        }

        b.searchInput.addTextChangedListener(object : android.text.TextWatcher {
            override fun afterTextChanged(s: android.text.Editable?) = apply()
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
        })

        refresh()
    }

    override fun refresh() {
        if (_b == null) return
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { officerSegments() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    all = parse(r.value)
                    apply()
                }

                is ApiResult.Err -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    if (all.isEmpty()) {
                        b.errorState.visibility = View.VISIBLE
                        b.errorText.text = r.message
                    }
                }
            }
        }
    }

    private fun parse(data: JsonObject): List<RoadRow> =
        data.arr("segments")?.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            val f = o.getAsJsonObject("forecast")
            RoadRow(
                segmentId = o.get("segmentId")?.asString ?: return@mapNotNull null,
                name = o.get("name")?.asString.orEmpty(),
                status = o.get("status")?.asString ?: "UNKNOWN",
                statusNote = o.get("statusNote")?.takeIf { !it.isJsonNull }?.asString,
                lengthKm = o.get("lengthKm")?.takeIf { !it.isJsonNull }?.asDouble ?: 0.0,
                riskLevel = o.get("riskLevel")?.takeIf { !it.isJsonNull }?.asString ?: "LOW",
                isChokepoint = o.get("isChokepoint")?.takeIf { !it.isJsonNull }?.asBoolean ?: false,
                lifelineFor = o.getAsJsonArray("lifelineFor")?.mapNotNull { it.asString }.orEmpty(),
                h24 = f?.get("h24")?.takeIf { !it.isJsonNull }?.asDouble,
                h48 = f?.get("h48")?.takeIf { !it.isJsonNull }?.asDouble,
                h72 = f?.get("h72")?.takeIf { !it.isJsonNull }?.asDouble,
                drivers = f?.getAsJsonArray("drivers")?.mapNotNull { it.asString }.orEmpty(),
                observedSpeedKmph = o.get("observedSpeedKmph")?.takeIf { !it.isJsonNull }?.asDouble,
                baselineSpeedKmph = o.get("baselineSpeedKmph")?.takeIf { !it.isJsonNull }?.asDouble
            )
        }.orEmpty()

    private fun apply() {
        if (_b == null) return
        val query = b.searchInput.text.toString().trim().lowercase()

        val rows = all
            .filter { r ->
                when (filter) {
                    "BLOCKED" -> r.status == "BLOCKED"
                    "DIFFICULT" -> r.status == "SLOW" || r.status == "RESTRICTED"
                    "CHOKEPOINT" -> r.isChokepoint
                    "RISK" -> (listOfNotNull(r.h24, r.h48, r.h72).maxOrNull() ?: 0.0) >= 0.35
                    else -> true
                }
            }
            .filter { query.isEmpty() || it.name.lowercase().contains(query) }
            .sortedWith(
                compareBy(
                    { statusRank(it.status) },
                    { -(listOfNotNull(it.h24, it.h48, it.h72).maxOrNull() ?: 0.0) }
                )
            )

        adapter.submitList(rows)
        b.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
        b.countLine.text = "${rows.size} of ${all.size} roads"
    }

    private fun statusRank(s: String) = when (s) {
        "BLOCKED" -> 0
        "RESTRICTED" -> 1
        "SLOW" -> 2
        "UNKNOWN" -> 3
        else -> 4
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
