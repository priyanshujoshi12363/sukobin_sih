package com.sukobin.partner.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The carriers are the sensor network. Every fix this sends is map-matched to a
 * road on the server, and a rolling median of those speeds is what tells the
 * platform a road has slowed or stopped — without anybody reporting anything.
 *
 * It only runs while the driver is online. Going offline stops it, because a
 * driver who is not working should not be tracked.
 */
object LocationReporter {

    private const val TAG = "SukobinLocation"

    // Frequent enough that a stopped vehicle is visible within a few minutes,
    // sparse enough not to drain a phone that is out all day.
    private const val INTERVAL_MS = 20_000L
    private const val FASTEST_MS = 10_000L
    private const val MIN_DISPLACEMENT_M = 40f

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var client: com.google.android.gms.location.FusedLocationProviderClient? = null
    private var callback: LocationCallback? = null

    @Volatile
    var running = false
        private set

    @Volatile
    var onTrip = false

    /** Latest road the server matched us to, for the home screen to show. */
    @Volatile
    var lastRoadName: String? = null
        private set

    @Volatile
    var lastRoadStatus: String? = null
        private set

    var onRoadUpdate: ((name: String?, status: String?) -> Unit)? = null

    fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    fun start(context: Context) {
        if (running) return
        if (!hasPermission(context)) {
            Log.i(TAG, "no location permission, not starting")
            return
        }

        val app = context.applicationContext
        client = LocationServices.getFusedLocationProviderClient(app)

        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, INTERVAL_MS)
            .setMinUpdateIntervalMillis(FASTEST_MS)
            .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_M)
            .build()

        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { send(it) }
            }
        }

        try {
            client?.requestLocationUpdates(request, callback!!, Looper.getMainLooper())
            running = true
            Log.i(TAG, "streaming started")
        } catch (e: SecurityException) {
            Log.w(TAG, "permission revoked mid-flight: ${e.message}")
        }
    }

    fun stop() {
        callback?.let { client?.removeLocationUpdates(it) }
        callback = null
        running = false
        lastRoadName = null
        lastRoadStatus = null
        Log.i(TAG, "streaming stopped")
    }

    private fun send(location: Location) {
        // A fix this vague would drag the road's median speed around for no
        // reason. The server rejects it too; not sending it saves the round trip.
        if (location.accuracy > 120f) return

        val speedKmph = if (location.hasSpeed()) (location.speed * 3.6).toDouble() else null

        scope.launch {
            val body = jsonOf(
                "coordinates" to jsonArrayOf(location.longitude, location.latitude),
                "speedKmph" to speedKmph,
                "headingDeg" to if (location.hasBearing()) location.bearing.toDouble() else null,
                "accuracyM" to location.accuracy.toDouble(),
                "onTrip" to onTrip
            )

            when (val r = apiCall { partnerUpdateLocation(body) }) {
                is ApiResult.Ok -> {
                    val road = r.value.obj("road")
                    lastRoadName = road?.str("name")
                    lastRoadStatus = road?.str("status")
                    onRoadUpdate?.invoke(lastRoadName, lastRoadStatus)
                }

                // A dropped ping is not worth surfacing. The next one is 20s away.
                is ApiResult.Err -> Log.d(TAG, "ping failed: ${r.message}")
            }
        }
    }
}
