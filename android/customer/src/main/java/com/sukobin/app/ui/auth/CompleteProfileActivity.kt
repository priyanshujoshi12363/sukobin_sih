package com.sukobin.app.ui.auth

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityCompleteProfileBinding
import com.sukobin.app.ui.main.MainActivity
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.UserProfile
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import kotlinx.coroutines.launch

class CompleteProfileActivity : AppCompatActivity() {

    private lateinit var b: ActivityCompleteProfileBinding

    private var lng: Double? = null
    private var lat: Double? = null
    private var busy = false

    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) captureLocation() else toast(getString(R.string.profile_location_missing)) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityCompleteProfileBinding.inflate(layoutInflater)
        setContentView(b.root)

        Session.name?.let { b.inputName.setText(it) }

        b.btnUseLocation.setOnClickListener { requestLocation() }
        b.btnSave.setOnClickListener { save() }
    }

    private fun requestLocation() {
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (granted) captureLocation()
        else locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    private fun captureLocation() {
        b.locationSpinner.visibility = View.VISIBLE

        try {
            LocationServices.getFusedLocationProviderClient(this)
                .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, null)
                .addOnSuccessListener { loc ->
                    b.locationSpinner.visibility = View.GONE
                    if (loc == null) {
                        toast(getString(R.string.profile_location_missing))
                        return@addOnSuccessListener
                    }
                    lng = loc.longitude
                    lat = loc.latitude
                    b.locationLabel.text = getString(R.string.profile_location_set)
                }
                .addOnFailureListener {
                    b.locationSpinner.visibility = View.GONE
                    toast(getString(R.string.profile_location_missing))
                }
        } catch (e: SecurityException) {
            b.locationSpinner.visibility = View.GONE
            toast(getString(R.string.profile_location_missing))
        }
    }

    private fun EditText.value(): String = text.toString().trim()

    private fun save() {
        if (busy) return

        val name = b.inputName.value()
        val house = b.inputHouse.value()
        val landmark = b.inputLandmark.value()
        val village = b.inputVillage.value()
        val town = b.inputTown.value()
        val district = b.inputDistrict.value()
        val state = b.inputState.value()
        val pincode = b.inputPincode.value()

        if (name.isEmpty() || district.isEmpty() || state.isEmpty() || pincode.isEmpty()) {
            toast(getString(R.string.profile_error_required))
            return
        }

        val currentLng = lng
        val currentLat = lat
        if (currentLng == null || currentLat == null) {
            toast(getString(R.string.profile_location_missing))
            return
        }

        val fullAddress = listOf(house, landmark, village, town, district, state, pincode)
            .filter { it.isNotEmpty() }
            .joinToString(", ")

        setBusy(true)

        lifecycleScope.launch {
            val result = apiCall {
                userCompleteRegistration(
                    jsonOf(
                        "name" to name,
                        "houseNumber" to house,
                        "landmark" to landmark,
                        "village" to village,
                        "town" to town,
                        "district" to district,
                        "state" to state,
                        "pincode" to pincode,
                        "fullAddress" to fullAddress,
                        "location" to jsonArrayOf(currentLng, currentLat)
                    )
                )
            }

            setBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    result.value.decode<UserProfile>("user")?.let { user ->
                        Session.name = user.name
                        Session.userId = user.id
                        Session.phone = user.phone
                        Session.address = user.address?.display()?.ifBlank { null } ?: fullAddress
                    }
                    startActivity(
                        Intent(this@CompleteProfileActivity, MainActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    )
                    finish()
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        b.saveSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnSave.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
