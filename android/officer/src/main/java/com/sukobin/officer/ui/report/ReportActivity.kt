package com.sukobin.officer.ui.report

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.Upload
import com.sukobin.core.net.arr
import com.sukobin.core.ui.Motion
import com.sukobin.core.voice.Voice
import com.sukobin.officer.R
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.QueuedReport
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.ActivityReportBinding
import com.sukobin.officer.ui.Status
import kotlinx.coroutines.launch
import coil.load
import java.io.File
import java.time.Instant

class ReportActivity : AppCompatActivity() {

    private lateinit var b: ActivityReportBinding

    // Built eagerly for the same reason as in OtpActivity.
    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) readLocation() else onLocationUnavailable(R.string.report_location_refused)
    }

    private val fused by lazy { LocationServices.getFusedLocationProviderClient(this) }

    // Clause (f) of the problem statement asks for photos by name, and a photo
    // is what turns "there is a landslide" into something a senior officer can
    // confirm without driving out to look.
    private val photos = mutableListOf<Uri>()
    private var cameraTarget: Uri? = null

    private val takePhoto = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { saved ->
        if (saved) cameraTarget?.let { photos.add(it); renderPhotos() }
    }

    private val cameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchCamera()
        else Toast.makeText(this, getString(R.string.report_need_camera), Toast.LENGTH_SHORT).show()
    }

    private val pickPhotos = registerForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(3)
    ) { uris ->
        if (uris.isNotEmpty()) {
            photos.clear()
            photos.addAll(uris.take(3))
            renderPhotos()
        }
    }

    private val dictate = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val heard = Voice.firstResult(result.data)
        if (heard.isNullOrBlank()) {
            Toast.makeText(this, getString(R.string.voice_nothing_heard), Toast.LENGTH_SHORT).show()
        } else {
            val existing = b.descriptionInput.text?.toString().orEmpty()
            b.descriptionInput.setText(if (existing.isBlank()) heard else "$existing $heard")
            b.descriptionInput.setSelection(b.descriptionInput.text?.length ?: 0)
        }
    }

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
        setupVoice()

        b.btnCamera.setOnClickListener { requestCamera() }
        b.btnGallery.setOnClickListener {
            pickPhotos.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }
        b.btnClearPhotos.setOnClickListener { photos.clear(); renderPhotos() }
        renderPhotos()

        b.blocksSwitch.setOnCheckedChangeListener { _, checked ->
            b.clearanceGroup.visibility = if (checked) View.VISIBLE else View.GONE
        }

        requestLocation()
    }

    private fun requestCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            launchCamera()
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCamera() {
        if (photos.size >= 3) {
            Toast.makeText(this, getString(R.string.report_photo_limit), Toast.LENGTH_SHORT).show()
            return
        }
        val dir = File(cacheDir, "photos").apply { mkdirs() }
        val file = File(dir, "report_${System.currentTimeMillis()}.jpg")
        val target = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        cameraTarget = target
        try {
            takePhoto.launch(target)
        } catch (e: Exception) {
            Toast.makeText(this, getString(R.string.report_no_camera), Toast.LENGTH_SHORT).show()
        }
    }

    private fun renderPhotos() {
        val previews = listOf(b.photo1, b.photo2, b.photo3)
        previews.forEachIndexed { i, view ->
            val uri = photos.getOrNull(i)
            view.visibility = if (uri == null) View.GONE else View.VISIBLE
            if (uri != null) view.load(uri) { crossfade(true) }
        }

        b.photoStrip.visibility = if (photos.isEmpty()) View.GONE else View.VISIBLE
        b.btnClearPhotos.visibility = if (photos.isEmpty()) View.GONE else View.VISIBLE
        b.photoHint.text = if (photos.isEmpty()) {
            getString(R.string.report_photo_none)
        } else {
            resources.getQuantityString(R.plurals.report_photo_count, photos.size, photos.size)
        }
    }

    private fun setupVoice() {
        val lang = OfficerSession.language
        val support = Voice.resolve(lang)

        if (!Voice.sttAvailable(this)) {
            b.btnSpeak.visibility = View.GONE
            return
        }

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
            onLocationUnavailable(R.string.report_location_refused)
        }
    }

    private fun fallbackToLastKnown() {
        try {
            fused.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc != null) onLocation(loc)
                    else onLocationUnavailable(R.string.report_no_gps_fix)
                }
                .addOnFailureListener { onLocationUnavailable(R.string.report_no_gps_fix) }
        } catch (e: SecurityException) {
            onLocationUnavailable(R.string.report_location_refused)
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

    private fun onLocationUnavailable(reason: Int) {
        b.locationSpinner.visibility = View.GONE
        b.locationState.setText(reason)
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
        val labels = Status.incidentTypeLabels(this)
        b.typeInput.setAdapter(ArrayAdapter(this, android.R.layout.simple_list_item_1, labels))
        b.typeInput.setText(labels.first(), false)
        b.typeInput.setOnItemClickListener { _, _, position, _ ->
            type = Status.INCIDENT_TYPE_CODES[position]
            b.typeInput.setText(labels[position], false)
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
            localPhotos = photos.map { it.toString() },
            spokenLang = OfficerSession.language,
            blocksTraffic = b.blocksSwitch.isChecked,
            estimatedClearanceHours = clearance
        )

        // Written to disk first. Whatever the network does next, the report is
        // already safe on the phone.
        ReportQueue.add(report)

        lifecycleScope.launch {
            val result = ReportQueue.sync(this@ReportActivity)
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
