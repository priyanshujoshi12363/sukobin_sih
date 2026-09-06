package com.sukobin.partner.ui.report

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import coil.load
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.Upload
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.bool
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.ui.Motion
import com.sukobin.core.voice.Voice
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivitySpeakReportBinding
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.util.UUID

/**
 * Report a hazard by taking a photo and just saying what you see, in whatever
 * language you speak. The model on the server turns rough speech into a
 * structured report and an English translation for the officer.
 *
 * The driver always sees what was understood before anything is filed. Speech
 * from a moving vehicle is rough, and a report that closes a highway should
 * not be sent on a guess nobody checked.
 */
class SpeakReportActivity : AppCompatActivity() {

    private lateinit var b: ActivitySpeakReportBinding

    private var lng: Double? = null
    private var lat: Double? = null
    private var accuracyM = 0.0

    private var segmentId: String? = null
    private var segmentName: String? = null

    private var photoUri: Uri? = null
    private var cameraTarget: Uri? = null

    private var spoken: String = ""
    private var busy = false

    // What the server understood, held so Send posts the confirmed reading.
    private var readType: String? = null
    private var readSeverity: String? = null
    private var readBlocks: Boolean = true

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) readLocation()
        else b.locationLine.setText(R.string.speak_need_location)
    }

    private val dictate = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val heard = Voice.firstResult(result.data)
        if (heard.isNullOrBlank()) {
            toast(getString(R.string.voice_nothing_heard))
        } else {
            spoken = heard
            b.spokenText.text = heard
            b.spokenBlock.visibility = View.VISIBLE
            understand()
        }
    }

    private val takePhoto = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { saved ->
        if (saved) {
            photoUri = cameraTarget
            showPhoto()
        }
    }

    private val cameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) launchCamera() else toast(getString(R.string.speak_need_camera)) }

    private val pickPhoto = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri -> if (uri != null) { photoUri = uri; showPhoto() } }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivitySpeakReportBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        segmentId = intent.getStringExtra(EXTRA_SEGMENT_ID)
        segmentName = intent.getStringExtra(EXTRA_SEGMENT_NAME)
        b.roadLine.text = segmentName ?: getString(R.string.speak_finding_road)

        b.btnBack.setOnClickListener { finish() }
        b.btnSpeak.setOnClickListener { speak() }
        b.btnSpeakAgain.setOnClickListener { speak() }
        b.btnCamera.setOnClickListener { requestCamera() }
        b.btnGallery.setOnClickListener {
            pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
        b.btnSend.setOnClickListener { send() }

        val support = Voice.resolve(Session.language)
        b.speakHint.text = if (support.exact) {
            getString(R.string.speak_hint, languageName(Session.language))
        } else {
            getString(R.string.speak_hint_fallback, languageName(Session.language), languageName(support.usingCode))
        }

        if (!Voice.sttAvailable(this)) {
            b.btnSpeak.isEnabled = false
            b.speakHint.setText(R.string.voice_unavailable)
        }

        requestLocation()
        updateSendState()
    }

    // ── location ─────────────────────────────────────────────────────────────

    private fun requestLocation() {
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
        val client = LocationServices.getFusedLocationProviderClient(this)
        try {
            client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                .addOnSuccessListener { loc -> if (loc != null) onLocation(loc) else lastKnown(client) }
                .addOnFailureListener { lastKnown(client) }
        } catch (e: SecurityException) {
            b.locationLine.setText(R.string.speak_need_location)
        }
    }

    private fun lastKnown(client: com.google.android.gms.location.FusedLocationProviderClient) {
        try {
            client.lastLocation
                .addOnSuccessListener { loc ->
                    if (loc != null) onLocation(loc) else b.locationLine.setText(R.string.hazard_no_fix)
                }
                .addOnFailureListener { b.locationLine.setText(R.string.hazard_no_fix) }
        } catch (e: SecurityException) {
            b.locationLine.setText(R.string.speak_need_location)
        }
    }

    private fun onLocation(loc: Location) {
        lng = loc.longitude
        lat = loc.latitude
        accuracyM = loc.accuracy.toDouble()
        b.locationLine.text = getString(R.string.hazard_located, loc.accuracy.toInt())

        if (segmentId == null) resolveRoad()
        updateSendState()
    }

    private fun resolveRoad() {
        val x = lng ?: return
        val y = lat ?: return

        lifecycleScope.launch {
            when (val r = apiCall { partnerWhereAmI(x, y) }) {
                is ApiResult.Ok -> {
                    val seg = r.value.obj("segment")
                    segmentId = seg?.str("segmentId")
                    segmentName = seg?.str("name")
                    b.roadLine.text = segmentName ?: getString(R.string.hazard_road_unknown)
                }
                is ApiResult.Err -> b.roadLine.setText(R.string.hazard_road_offline)
            }
        }
    }

    // ── photo ────────────────────────────────────────────────────────────────

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
        val dir = File(cacheDir, "photos").apply { mkdirs() }
        val file = File(dir, "hazard_${System.currentTimeMillis()}.jpg")
        val target = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
        cameraTarget = target
        try {
            takePhoto.launch(target)
        } catch (e: Exception) {
            toast(getString(R.string.speak_no_camera))
        }
    }

    private fun showPhoto() {
        b.photoPreview.visibility = View.VISIBLE
        b.photoPreview.load(photoUri) { crossfade(true) }
        b.photoHint.setText(R.string.speak_photo_added)
        updateSendState()
    }

    // ── speech, then what the model made of it ───────────────────────────────

    private fun speak() {
        try {
            dictate.launch(Voice.dictationIntent(Session.language, getString(R.string.speak_prompt)))
        } catch (e: Exception) {
            toast(getString(R.string.voice_unavailable))
        }
    }

    private fun understand() {
        b.readingBlock.visibility = View.VISIBLE
        b.readingSpinner.visibility = View.VISIBLE
        b.readingSummary.setText(R.string.speak_reading)
        b.readingDetail.text = ""
        b.readingWarning.visibility = View.GONE
        updateSendState()

        lifecycleScope.launch {
            val body = jsonOf(
                "spokenText" to spoken,
                "spokenLang" to Session.language,
                "segmentId" to segmentId,
                "photoCount" to if (photoUri != null) 1 else 0
            )

            val r = apiCall { partnerUnderstandReport(body) }
            b.readingSpinner.visibility = View.GONE

            when (r) {
                is ApiResult.Ok -> {
                    val c = r.value.obj("confirm")
                    val u = r.value.obj("understood")

                    readType = c?.str("type")
                    readSeverity = c?.str("severity")
                    readBlocks = c?.bool("blocksTraffic") ?: true

                    b.readingSummary.text = c?.str("headline")
                        ?: u?.str("english")
                        ?: spoken

                    val hours = c?.get("clearanceHours")?.takeIf { !it.isJsonNull }?.asInt
                    b.readingDetail.text = listOfNotNull(
                        typeLabel(readType),
                        if (readBlocks) getString(R.string.speak_blocks)
                        else getString(R.string.speak_passable),
                        hours?.let { getString(R.string.speak_clears_in, it) }
                    ).joinToString("  ·  ")

                    // Speech from a moving vehicle is rough. When the model is
                    // unsure, say so rather than presenting a guess as fact.
                    val uncertain = c?.bool("uncertain") ?: false
                    val byKeywords = c?.str("readBy") == "keywords"
                    b.readingWarning.visibility =
                        if (uncertain || byKeywords) View.VISIBLE else View.GONE
                    b.readingWarning.setText(
                        if (byKeywords) R.string.speak_offline_reading else R.string.speak_check_this
                    )
                }

                is ApiResult.Err -> {
                    // The words are still worth sending even if nothing read them.
                    b.readingSummary.text = spoken
                    b.readingDetail.setText(R.string.speak_could_not_read)
                    b.readingWarning.visibility = View.VISIBLE
                    b.readingWarning.setText(R.string.speak_will_send_anyway)
                }
            }

            updateSendState()
        }
    }

    // ── send ─────────────────────────────────────────────────────────────────

    private fun updateSendState() {
        val ready = lng != null && lat != null && spoken.isNotBlank() && !busy
        b.btnSend.isEnabled = ready
        b.btnSend.alpha = if (ready) 1f else 0.45f
        b.sendHint.text = when {
            spoken.isBlank() -> getString(R.string.speak_say_first)
            lng == null -> getString(R.string.speak_waiting_location)
            else -> getString(R.string.speak_send_hint)
        }
    }

    private fun send() {
        if (busy) return
        val x = lng ?: return
        val y = lat ?: return

        busy = true
        updateSendState()
        b.sendSpinner.visibility = View.VISIBLE

        val photos = photoUri?.let { listOfNotNull(Upload.part(this, it, "photos")) } ?: emptyList()

        lifecycleScope.launch {
            val r = apiCall {
                partnerVoiceReport(
                    Upload.text("drv-" + UUID.randomUUID()),
                    Upload.text(segmentId.orEmpty()),
                    Upload.text(spoken),
                    Upload.text(Session.language),
                    Upload.text("$x,$y"),
                    Upload.text(accuracyM.toString()),
                    Upload.text(Instant.now().toString()),
                    Upload.text(readType.orEmpty()),
                    Upload.text(readSeverity.orEmpty()),
                    Upload.text(readBlocks.toString()),
                    photos
                )
            }

            busy = false
            b.sendSpinner.visibility = View.GONE
            updateSendState()
            Upload.clearCache(this@SpeakReportActivity)

            when (r) {
                is ApiResult.Ok -> {
                    toast(getString(R.string.hazard_sent))
                    finish()
                }
                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun typeLabel(code: String?) = when (code) {
        "LANDSLIDE" -> getString(R.string.hazard_landslide)
        "FLOOD" -> getString(R.string.hazard_flood)
        "TREE_FALL" -> getString(R.string.hazard_tree)
        "ROAD_DAMAGE" -> getString(R.string.hazard_damage)
        "SNOW_ICE" -> getString(R.string.hazard_snow)
        "ACCIDENT" -> getString(R.string.hazard_accident)
        "BLOCKADE" -> getString(R.string.hazard_blockade)
        "CONGESTION" -> getString(R.string.hazard_congestion)
        null -> null
        else -> getString(R.string.hazard_other)
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

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }

    companion object {
        const val EXTRA_SEGMENT_ID = "segmentId"
        const val EXTRA_SEGMENT_NAME = "segmentName"
    }
}
