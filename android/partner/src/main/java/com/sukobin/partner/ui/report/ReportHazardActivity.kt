package com.sukobin.partner.ui.report

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.material.chip.Chip
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.net.Session
import com.sukobin.core.ui.Motion
import com.sukobin.core.voice.Voice
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivityReportHazardBinding
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

/**
 * A driver reporting a hazard has just pulled over on a hill road. The screen
 * is built for that: the road is already filled in from GPS, the hazard is one
 * tap out of six, and the description is optional. A report can be filed in
 * about four seconds without typing anything.
 */
class ReportHazardActivity : AppCompatActivity() {

    private lateinit var b: ActivityReportHazardBinding

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) readLocation()
        else showLocationProblem(getString(R.string.hazard_need_location))
    }

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }

    // Typing on a hill road with the engine running is the reason most hazards
    // never get reported. Dictation removes it.
    private val dictate = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val heard = Voice.firstResult(result.data)
        if (heard.isNullOrBlank()) {
            Toast.makeText(this, getString(R.string.voice_nothing_heard), Toast.LENGTH_SHORT).show()
        } else {
            val existing = b.noteInput.text?.toString().orEmpty()
            b.noteInput.setText(if (existing.isBlank()) heard else "$existing $heard")
            b.noteInput.setSelection(b.noteInput.text?.length ?: 0)
        }
    }

    private var lng: Double? = null
    private var lat: Double? = null
    private var accuracyM = 0.0

    private var segmentId: String? = null
    private var segmentName: String? = null

    private var type = "LANDSLIDE"
    private var blocksTraffic = true
    private var sending = false

    private val hazards = listOf(
        R.id.chip_landslide to "LANDSLIDE",
        R.id.chip_flood to "FLOOD",
        R.id.chip_tree to "TREE_FALL",
        R.id.chip_damage to "ROAD_DAMAGE",
        R.id.chip_snow to "SNOW_ICE",
        R.id.chip_accident to "ACCIDENT"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityReportHazardBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.btnRetryLocation.setOnClickListener { requestLocation() }
        b.btnSend.setOnClickListener { send() }
        setupVoice()

        b.hazardGroup.setOnCheckedStateChangeListener { group, ids ->
            val id = ids.firstOrNull() ?: return@setOnCheckedStateChangeListener
            type = hazards.firstOrNull { it.first == id }?.second ?: "OTHER"
            // A fallen tree or a slip usually leaves one lane; a landslide or
            // flood usually does not. Pre-set it, let the driver correct it.
            b.blocksSwitch.isChecked = type in setOf("LANDSLIDE", "FLOOD")
            group.findViewById<Chip>(id)
        }

        b.blocksSwitch.setOnCheckedChangeListener { _, checked -> blocksTraffic = checked }
        b.chipLandslide.isChecked = true

        requestLocation()
    }

    private fun setupVoice() {
        val lang = Session.language
        val support = Voice.resolve(lang)

        if (!Voice.sttAvailable(this)) {
            b.btnSpeak.visibility = View.GONE
            return
        }

        // Say plainly which language it will actually listen in. A mic button
        // that quietly listens in the wrong language is worse than none.
        b.speakHint.text = if (support.exact) {
            getString(R.string.voice_speak_hint, languageName(lang))
        } else {
            getString(R.string.voice_speak_fallback, languageName(lang), languageName(support.usingCode))
        }

        b.btnSpeak.setOnClickListener {
            try {
                dictate.launch(Voice.dictationIntent(lang, getString(R.string.voice_prompt)))
            } catch (e: Exception) {
                Toast.makeText(this, getString(R.string.voice_unavailable), Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun languageName(code: String) = when (code) {
        "hi" -> "हिन्दी"
        "bn" -> "বাংলা"
        "as" -> "অসমীয়া"
        "ne" -> "नेपाली"
        "mni" -> "Meiteilon"
        "kha" -> "Khasi"
        "lus" -> "Mizo"
        "nag" -> "Nagamese"
        "kok" -> "Kokborok"
        else -> "English"
    }

    private fun requestLocation() {
        b.locationLine.setText(R.string.hazard_finding)
        b.locationSpinner.visibility = View.VISIBLE
        b.btnRetryLocation.visibility = View.GONE

        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION)

        if (fine == PackageManager.PERMISSION_GRANTED || coarse == PackageManager.PERMISSION_GRANTED) {
            readLocation()
        } else {
            locationPermission.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    private fun readLocation() {
        try {
            fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    if (loc != null) onLocation(loc) else lastKnown()
                }
                .addOnFailureListener { lastKnown() }
        } catch (e: SecurityException) {
            showLocationProblem(getString(R.string.hazard_need_location))
        }
    }

    private fun lastKnown() {
        try {
            fused.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc != null) onLocation(loc)
                    else showLocationProblem(getString(R.string.hazard_no_fix))
                }
                .addOnFailureListener { showLocationProblem(getString(R.string.hazard_no_fix)) }
        } catch (e: SecurityException) {
            showLocationProblem(getString(R.string.hazard_need_location))
        }
    }

    private fun onLocation(loc: Location) {
        lng = loc.longitude
        lat = loc.latitude
        accuracyM = loc.accuracy.toDouble()

        b.locationSpinner.visibility = View.GONE
        b.btnRetryLocation.visibility = View.VISIBLE
        b.locationLine.text = getString(R.string.hazard_located, loc.accuracy.toInt())

        resolveRoad()
        updateSendState()
    }

    private fun showLocationProblem(message: String) {
        b.locationSpinner.visibility = View.GONE
        b.btnRetryLocation.visibility = View.VISIBLE
        b.locationLine.text = message
        updateSendState()
    }

    private fun resolveRoad() {
        val x = lng ?: return
        val y = lat ?: return
        b.roadLine.setText(R.string.hazard_matching_road)

        lifecycleScope.launch {
            when (val r = apiCall { partnerWhereAmI(x, y) }) {
                is ApiResult.Ok -> {
                    val seg = r.value.obj("segment")
                    segmentId = seg?.str("segmentId")
                    segmentName = seg?.str("name")
                    b.roadLine.text = segmentName ?: getString(R.string.hazard_road_unknown)
                }

                is ApiResult.Err -> {
                    // No signal here is normal. The server matches the road
                    // from the coordinates when the report gets through.
                    b.roadLine.setText(R.string.hazard_road_offline)
                }
            }
        }
    }

    private fun updateSendState() {
        val ready = lng != null && lat != null
        b.btnSend.isEnabled = ready && !sending
        b.btnSend.alpha = if (ready) 1f else 0.45f
    }

    private fun send() {
        if (sending) return
        val x = lng ?: return
        val y = lat ?: return

        sending = true
        updateSendState()
        b.sendSpinner.visibility = View.VISIBLE

        val note = b.noteInput.text.toString().trim()

        val body = jsonOf(
            // Device-generated, so a retry on a flaky hill connection cannot
            // file the same hazard twice.
            "clientId" to "drv-" + UUID.randomUUID(),
            "segmentId" to segmentId,
            "type" to type,
            "severity" to if (blocksTraffic) "HIGH" else "MEDIUM",
            "description" to note.ifBlank { defaultDescription() },
            "coordinates" to jsonArrayOf(x, y),
            "accuracyM" to accuracyM,
            "capturedAt" to Instant.now().toString(),
            "impact" to jsonOf("blocksTraffic" to blocksTraffic)
        )

        lifecycleScope.launch {
            val r = apiCall { partnerReportHazard(body) }
            sending = false
            b.sendSpinner.visibility = View.GONE
            updateSendState()

            when (r) {
                is ApiResult.Ok -> {
                    Toast.makeText(
                        this@ReportHazardActivity,
                        getString(R.string.hazard_sent),
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }

                is ApiResult.Err ->
                    Toast.makeText(this@ReportHazardActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    // The report still has to say something useful when the driver types nothing.
    private fun defaultDescription(): String {
        val what = when (type) {
            "LANDSLIDE" -> "Landslide on the road"
            "FLOOD" -> "Water over the road"
            "TREE_FALL" -> "Tree down across the road"
            "ROAD_DAMAGE" -> "Road surface damaged"
            "SNOW_ICE" -> "Snow or ice on the road"
            "ACCIDENT" -> "Accident blocking the road"
            else -> "Hazard on the road"
        }
        val effect = if (blocksTraffic) "Nothing can pass." else "Traffic is getting through slowly."
        return "$what. $effect Reported by a driver on the road."
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
