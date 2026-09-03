package com.sukobin.app.ui.parcel

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityPickLocationBinding
import com.sukobin.core.ui.Motion
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

class PickLocationActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_TARGET = "target"
        const val EXTRA_LAT = "lat"
        const val EXTRA_LNG = "lng"
        const val EXTRA_ADDRESS = "address"
        const val TARGET_PICKUP = "pickup"
        const val TARGET_DROP = "drop"

        private val FALLBACK = LatLng(26.1445, 91.7362)
    }

    private lateinit var b: ActivityPickLocationBinding
    private var map: GoogleMap? = null
    private var resolveJob: Job? = null
    private var address: String = ""

    private val target: String by lazy {
        intent.getStringExtra(EXTRA_TARGET) ?: TARGET_PICKUP
    }

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) goToMyLocation() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityPickLocationBinding.inflate(layoutInflater)
        setContentView(b.root)

        Motion.applyEnter(this)

        b.sheetLabel.setText(
            if (target == TARGET_DROP) R.string.pick_drop else R.string.pick_pickup
        )

        b.btnBack.setOnClickListener { finish() }
        b.btnMyLocation.setOnClickListener { requestMyLocation() }
        b.btnConfirm.setOnClickListener { confirm() }

        val mapFragment = supportFragmentManager.findFragmentById(R.id.map) as SupportMapFragment
        mapFragment.getMapAsync { googleMap ->
            map = googleMap
            googleMap.uiSettings.isZoomControlsEnabled = false
            googleMap.uiSettings.isMapToolbarEnabled = false

            val startLat = intent.getDoubleExtra(EXTRA_LAT, Double.NaN)
            val startLng = intent.getDoubleExtra(EXTRA_LNG, Double.NaN)

            val start =
                if (!startLat.isNaN() && !startLng.isNaN()) LatLng(startLat, startLng)
                else FALLBACK

            googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(start, 15f))

            googleMap.setOnCameraMoveStartedListener {
                b.centerPin.animate().translationY(-10f).setDuration(120).start()
            }

            googleMap.setOnCameraIdleListener {
                b.centerPin.animate().translationY(0f).setDuration(160).start()
                resolveAddress(googleMap.cameraPosition.target)
            }

            resolveAddress(start)
            if (startLat.isNaN()) requestMyLocation()
        }
    }

    private fun requestMyLocation() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) goToMyLocation()
        else locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    private fun goToMyLocation() {
        try {
            LocationServices.getFusedLocationProviderClient(this)
                .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    if (loc == null) return@addOnSuccessListener
                    map?.animateCamera(
                        CameraUpdateFactory.newLatLngZoom(
                            LatLng(loc.latitude, loc.longitude),
                            16f
                        )
                    )
                }
        } catch (e: SecurityException) {
            // permission was revoked between the check and the call
        }
    }

    private fun resolveAddress(point: LatLng) {
        resolveJob?.cancel()
        b.resolving.visibility = View.VISIBLE

        resolveJob = lifecycleScope.launch {
            delay(280)
            val text = reverseGeocode(point)
            address = text
            b.resolving.visibility = View.GONE
            b.addressText.text = text
        }
    }

    private suspend fun reverseGeocode(point: LatLng): String = withContext(Dispatchers.IO) {
        val fallback = String.format(
            Locale.ROOT, "%.5f, %.5f", point.latitude, point.longitude
        )

        try {
            val geocoder = Geocoder(this@PickLocationActivity, Locale.getDefault())

            @Suppress("DEPRECATION")
            val results =
                if (Build.VERSION.SDK_INT >= 33) {
                    // the async API needs a callback; the blocking one is fine on IO
                    geocoder.getFromLocation(point.latitude, point.longitude, 1)
                } else {
                    geocoder.getFromLocation(point.latitude, point.longitude, 1)
                }

            val a = results?.firstOrNull() ?: return@withContext fallback

            val parts = listOfNotNull(
                a.subThoroughfare,
                a.thoroughfare,
                a.subLocality,
                a.locality,
                a.subAdminArea?.takeIf { it != a.locality },
                a.adminArea,
                a.postalCode
            ).distinct()

            if (parts.isEmpty()) fallback else parts.joinToString(", ")
        } catch (e: Exception) {
            fallback
        }
    }

    private fun confirm() {
        val point = map?.cameraPosition?.target ?: return

        setResult(
            RESULT_OK,
            Intent()
                .putExtra(EXTRA_TARGET, target)
                .putExtra(EXTRA_LAT, point.latitude)
                .putExtra(EXTRA_LNG, point.longitude)
                .putExtra(EXTRA_ADDRESS, address)
        )
        finish()
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
