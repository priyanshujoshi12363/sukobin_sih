package com.sukobin.officer.ui.report

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.ui.Motion
import com.sukobin.officer.R
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.QueuedReport
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.ActivityReportBinding
import com.sukobin.officer.ui.Status
import kotlinx.coroutines.launch
import java.time.Instant

class ReportActivity : AppCompatActivity() {

    private lateinit var b: ActivityReportBinding

    // Built eagerly for the same reason as in OtpActivity.
    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) readLocation() else onLocationUnavailable("Location permission refused")
    }

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }

    private var lng: Double? = null
    private var lat: Double? = null
    private var accuracyM: Double = 0.0

    private data class NearbyRoad(
        val segmentId: String,
        val name: String,
        val distanceKm: Double,
        val district: String?,
        val state: String?
    )

    private var nearby: List<NearbyRoad> = emptyList()
    private var chosenRoad: NearbyRoad? = null
    private var type: String = "LANDSLIDE"
    private var severity: String = "HIGH"
    private var saving = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityReportBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.btnRetryLocation.setOnClickListener { requestLocation() }
        b.btnSave.setOnClickListener { save() }

        setupTypeDropdown()
        setupSeverityChips()

        b.blocksSwitch.setOnCheckedChangeListener { _, checked ->
            b.clearanceGroup.visibility = if (checked) View.VISIBLE else View.GONE
        }

        requestLocation()
    }

    // ── location and road ────────────────────────────────────────────────────

    private fun requestLocation() {
        b.locationState.text = getString(R.string.report_finding_location)
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
                .addOnSuccessListener { loc -> if (loc != null) onLocation(loc) else fallbackToLastKnown() }
                .addOnFailureListener { fallbackToLastKnown() }
        } catch (e: SecurityException) {
            onLocationUnavailable("Location permission refused")
        }
    }

    private fun fallbackToLastKnown() {
        try {
            fused.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc != null) onLocation(loc)
                    else onLocationUnavailable("Could not get a GPS fix")
                }
                .addOnFailureListener { onLocationUnavailable("Could not get a GPS fix") }
        } catch (e: SecurityException) {
            onLocationUnavailable("Location permission refused")
        }
    }

    private fun onLocation(loc: Location) {
        lng = loc.longitude
        lat = loc.latitude
        accuracyM = loc.accuracy.toDouble()

        b.locationSpinner.visibility = View.GONE
        b.locationState.text = String.format("%.5f, %.5f  (±%.0f m)", loc.latitude, loc.longitude, loc.accuracy)
        b.btnRetryLocation.visibility = View.VISIBLE
        b.btnRetryLocation.text = getString(R.string.report_update_location)

        loadNearby()
        updateSaveState()
    }

    private fun onLocationUnavailable(reason: String) {
        b.locationSpinner.visibility = View.GONE
        b.locationState.text = reason
        b.btnRetryLocation.visibility = View.VISIBLE
        b.btnRetryLocation.text = getString(R.string.report_try_again)
        updateSaveState()
    }

    private fun loadNearby() {
        val x = lng ?: return
        val y = lat ?: return

        b.roadHint.text = getString(R.string.report_looking_for_roads)

        lifecycleScope.launch {
            when (val r = apiCall { officerNearby(x, y, 30) }) {
                is ApiResult.Ok -> {
                    nearby = r.value.arr("segments")?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        NearbyRoad(
                            segmentId = o.get("segmentId")?.asString ?: return@mapNotNull null,
                            name = o.get("name")?.asString.orEmpty(),
                            distanceKm = o.get("distanceKm")?.takeIf { !it.isJsonNull }?.asDouble ?: 0.0,
                            district = o.getAsJsonArray("districts")?.firstOrNull()?.asString,
                            state = o.getAsJsonArray("states")?.firstOrNull()?.asString
                        )
                    }.orEmpty()

                    if (nearby.isEmpty()) {
                        b.roadHint.text = getString(R.string.report_no_roads_near)
                    } else {
                        chosenRoad = nearby.first()
                        b.roadInput.setAdapter(
                            ArrayAdapter(
                                this@ReportActivity,
                                android.R.layout.simple_list_item_1,
                                nearby.map { "${it.name}  ·  ${fmtKm(it.distanceKm)} away" }
                            )
                        )
                        b.roadInput.setText(chosenRoad!!.name, false)
                        b.roadInput.setOnItemClickListener { _, _, position, _ ->
                            chosenRoad = nearby[position]
                            b.roadInput.setText(chosenRoad!!.name, false)
                            updateRoadHint()
                        }
                        updateRoadHint()
                    }
                    updateSaveState()
                }

                is ApiResult.Err -> {
                    // No signal is the normal case out here. The report still
                    // gets saved; the server matches the road when it arrives.
                    b.roadHint.text = getString(R.string.report_offline_road_hint)
                    updateSaveState()
                }
            }
        }
    }

    private fun updateRoadHint() {
        val road = chosenRoad ?: return
        b.roadHint.text = getString(R.string.report_road_distance, fmtKm(road.distanceKm))
    }

    private fun fmtKm(km: Double) = if (km < 1) "${Math.round(km * 1000)} m" else String.format("%.1f km", km)

    // ── form ─────────────────────────────────────────────────────────────────

    private fun setupTypeDropdown() {
        b.typeInput.setAdapter(
            ArrayAdapter(this, android.R.layout.simple_list_item_1, Status.INCIDENT_TYPES.map { it.second })
        )
        b.typeInput.setText(Status.INCIDENT_TYPES.first().second, false)
        b.typeInput.setOnItemClickListener { _, _, position, _ ->
            type = Status.INCIDENT_TYPES[position].first
            b.typeInput.setText(Status.INCIDENT_TYPES[position].second, false)
        }
    }

    private fun setupSeverityChips() {
        b.severityGroup.setOnCheckedStateChangeListener { _, ids ->
            severity = when (ids.firstOrNull()) {
                R.id.chip_low -> "LOW"
                R.id.chip_medium -> "MEDIUM"
                R.id.chip_critical -> "CRITICAL"
                else -> "HIGH"
            }
            // "Road impassable" and "traffic still moving" cannot both be true.
            if (severity == "CRITICAL" && !b.blocksSwitch.isChecked) b.blocksSwitch.isChecked = true
        }
        b.chipHigh.isChecked = true
    }

    private fun updateSaveState() {
        val ready = lng != null && lat != null
        b.btnSave.isEnabled = ready && !saving
        b.btnSave.alpha = if (ready) 1f else 0.45f
        b.saveHint.text = if (ready) {
            getString(R.string.report_save_hint)
        } else {
            getString(R.string.report_need_location)
        }
    }

    // ── save ─────────────────────────────────────────────────────────────────

    private fun save() {
        if (saving) return
        val x = lng ?: return
        val y = lat ?: return

        val description = b.descriptionInput.text.toString().trim()
        if (description.length < 5) {
            b.descriptionLayout.error = getString(R.string.report_describe_error)
            return
        }
        b.descriptionLayout.error = null

        saving = true
        b.btnSave.isEnabled = false
        b.saveSpinner.visibility = View.VISIBLE

        val clearance = b.clearanceInput.text.toString().trim().toIntOrNull()

        val report = QueuedReport(
            clientId = ReportQueue.newClientId(),
            segmentId = chosenRoad?.segmentId,
            segmentName = chosenRoad?.name,
            type = type,
            severity = severity,
            description = description,
            lng = x,
            lat = y,
            accuracyM = accuracyM,
            district = chosenRoad?.district ?: OfficerSession.district,
            state = chosenRoad?.state ?: OfficerSession.state,
            capturedAt = Instant.now().toString(),
            blocksTraffic = b.blocksSwitch.isChecked,
            estimatedClearanceHours = clearance
        )

        // Written to disk first. Whatever the network does next, the report is
        // already safe on the phone.
        ReportQueue.add(report)

        lifecycleScope.launch {
            val result = ReportQueue.sync()
            saving = false
            b.saveSpinner.visibility = View.GONE

            val message = if (result.settled > 0) {
                getString(R.string.report_sent)
            } else {
                getString(R.string.report_saved_offline)
            }
            Toast.makeText(this@ReportActivity, message, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
