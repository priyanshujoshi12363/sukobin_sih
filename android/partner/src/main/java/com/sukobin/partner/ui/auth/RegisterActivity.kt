package com.sukobin.partner.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivityRegisterBinding
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var b: ActivityRegisterBinding

    private var verifiedVehicle: String? = null
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnBack.setOnClickListener { finish() }
        b.btnVerifyVehicle.setOnClickListener { verifyVehicle() }
        b.btnContinue.setOnClickListener { sendOtp() }

        b.linkLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        b.inputVehicle.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (verifiedVehicle != null && plate() != verifiedVehicle) resetVerification()
            }
        })
    }

    private fun plate(): String =
        b.inputVehicle.text.toString().trim().uppercase().replace(" ", "")

    private fun resetVerification() {
        verifiedVehicle = null
        b.vehicleCard.visibility = View.GONE
        b.detailsGroup.visibility = View.GONE
    }

    private fun verifyVehicle() {
        if (busy) return

        val number = plate()
        if (number.length < 6) {
            toast(getString(R.string.reg_error_vehicle))
            return
        }

        setVerifyBusy(true)

        lifecycleScope.launch {
            val result = apiCall { partnerVerifyVehicle(jsonOf("vehicleNumber" to number)) }
            setVerifyBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    val body = result.value
                    val vehicle = body.obj("vehicle")

                    verifiedVehicle = body.str("vehicleNumber") ?: number

                    val maker = vehicle?.str("maker")
                    val model = vehicle?.str("model")
                    val cls = vehicle?.str("vehicleClass")
                    val fuel = vehicle?.str("fuelType")
                    val owner = vehicle?.str("ownerName")

                    b.vehicleDetail.text = listOfNotNull(
                        listOfNotNull(maker, model).joinToString(" ").ifBlank { null },
                        cls,
                        fuel,
                        owner?.let { "Owner: $it" }
                    ).joinToString("\n")

                    val capacity = body.int("capacity", 0)
                    b.vehicleCapacity.visibility = if (capacity > 0) View.VISIBLE else View.GONE
                    if (capacity > 0) {
                        b.vehicleCapacity.text = getString(R.string.reg_capacity, capacity)
                    }

                    b.vehicleCard.visibility = View.VISIBLE
                    b.detailsGroup.visibility = View.VISIBLE
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun sendOtp() {
        if (busy) return

        val name = b.inputName.text.toString().trim()
        val phone = b.inputPhone.text.toString().trim()
        val vehicle = verifiedVehicle

        if (vehicle == null) {
            toast(getString(R.string.reg_error_vehicle))
            return
        }

        if (name.isEmpty() || phone.length != 10) {
            toast(getString(R.string.reg_error_fields))
            return
        }

        setContinueBusy(true)

        lifecycleScope.launch {
            val result = apiCall { partnerSendOtp(jsonOf("phone" to phone)) }
            setContinueBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    startActivity(
                        Intent(this@RegisterActivity, OtpActivity::class.java)
                            .putExtra(OtpActivity.EXTRA_PHONE, phone)
                            .putExtra(OtpActivity.EXTRA_MODE, OtpActivity.MODE_REGISTER)
                            .putExtra(OtpActivity.EXTRA_NAME, name)
                            .putExtra(OtpActivity.EXTRA_VEHICLE, vehicle)
                            .putExtra(OtpActivity.EXTRA_DEV_OTP, result.value.str("devOtp"))
                    )
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun setVerifyBusy(value: Boolean) {
        busy = value
        b.verifySpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.verifyLabel.setText(if (value) R.string.reg_verifying else R.string.reg_verify_cta)
        b.btnVerifyVehicle.isClickable = !value
    }

    private fun setContinueBusy(value: Boolean) {
        busy = value
        b.continueSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnContinue.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
