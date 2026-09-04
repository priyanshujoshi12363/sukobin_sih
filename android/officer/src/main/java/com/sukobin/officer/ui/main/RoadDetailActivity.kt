package com.sukobin.officer.ui.main

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.jsonOf
import com.sukobin.core.ui.Motion
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.databinding.ActivityRoadDetailBinding
import com.sukobin.officer.ui.Status
import kotlinx.coroutines.launch

class RoadDetailActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SEGMENT_ID = "segmentId"
        const val EXTRA_NAME = "name"
    }

    private lateinit var b: ActivityRoadDetailBinding
    private var segmentId: String = ""
    private var road: RoadRow? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityRoadDetailBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        segmentId = intent.getStringExtra(EXTRA_SEGMENT_ID).orEmpty()
        b.roadName.text = intent.getStringExtra(EXTRA_NAME).orEmpty()

        b.btnBack.setOnClickListener { finish() }
        b.btnSetStatus.visibility = if (OfficerSession.canVerify) View.VISIBLE else View.GONE
        b.btnSetStatus.setOnClickListener { pickStatus() }

        load()
    }

    private fun load() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { officerSegments() }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    val found = r.value.arr("segments")?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        if (o.get("segmentId")?.asString != segmentId) return@mapNotNull null
                        val f = o.getAsJsonObject("forecast")
                        RoadRow(
                            segmentId = segmentId,
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
                    }?.firstOrNull()

                    if (found == null) {
                        b.errorText.visibility = View.VISIBLE
                        b.errorText.text = "This road is outside your area"
                    } else {
                        road = found
                        render(found)
                    }
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    b.errorText.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun render(r: RoadRow) {
        b.content.visibility = View.VISIBLE
        b.roadName.text = r.name

        b.statusPill.text = Status.label(r.status)
        b.statusPill.setBackgroundResource(Status.pillBackground(r.status))
        b.statusNote.text = r.statusNote.orEmpty()
        b.statusNote.visibility = if (r.statusNote.isNullOrBlank()) View.GONE else View.VISIBLE

        b.lengthValue.text = "${r.lengthKm.toInt()} km"
        b.riskValue.text = r.riskLevel.lowercase().replaceFirstChar { it.uppercase() }
        b.riskValue.setTextColor(ContextCompat.getColor(this, Status.riskColor(r.riskLevel)))

        b.h24Value.text = Status.percent(r.h24)
        b.h48Value.text = Status.percent(r.h48)
        b.h72Value.text = Status.percent(r.h72)

        val peak = listOfNotNull(r.h24, r.h48, r.h72).maxOrNull()
        b.forecastSummary.text = Status.forecastPhrase(peak, 72)

        b.whyBlock.visibility = if (r.drivers.isEmpty()) View.GONE else View.VISIBLE
        b.whyText.text = r.drivers.joinToString("\n") { "  ·  $it" }

        val speed = r.observedSpeedKmph
        val base = r.baselineSpeedKmph
        if (speed != null && base != null && base > 0) {
            b.speedBlock.visibility = View.VISIBLE
            b.speedText.text = "Vehicles are moving at ${speed.toInt()} km/h. Normal for this road is ${base.toInt()} km/h."
        } else {
            b.speedBlock.visibility = View.GONE
        }

        val tags = buildList {
            if (r.isChokepoint) add("Weak point - few other ways round")
            if (r.lifelineFor.isNotEmpty()) add("Lifeline for ${r.lifelineFor.joinToString(", ")}")
        }
        b.tagText.text = tags.joinToString("\n") { "  ·  $it" }
        b.tagBlock.visibility = if (tags.isEmpty()) View.GONE else View.VISIBLE
    }

    private fun pickStatus() {
        val options = arrayOf("Open", "Slow", "Restricted", "Blocked")
        val codes = arrayOf("OPEN", "SLOW", "RESTRICTED", "BLOCKED")

        val input = android.widget.EditText(this).apply {
            hint = "Why? (shown to drivers)"
            setPadding(48, 32, 48, 32)
        }

        var selected = 0
        AlertDialog.Builder(this)
            .setTitle("Set road status")
            .setSingleChoiceItems(options, 0) { _, which -> selected = which }
            .setView(input)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Apply") { _, _ ->
                applyStatus(codes[selected], input.text.toString().trim())
            }
            .show()
    }

    private fun applyStatus(status: String, note: String) {
        lifecycleScope.launch {
            val r = apiCall {
                officerSetSegmentStatus(segmentId, jsonOf("status" to status, "note" to note, "hours" to 12))
            }

            when (r) {
                is ApiResult.Ok -> {
                    Toast.makeText(this@RoadDetailActivity, "Road set to ${Status.label(status).lowercase()}", Toast.LENGTH_LONG).show()
                    load()
                }
                is ApiResult.Err ->
                    Toast.makeText(this@RoadDetailActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
