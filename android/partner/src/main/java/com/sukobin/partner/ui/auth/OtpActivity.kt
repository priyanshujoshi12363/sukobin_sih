package com.sukobin.partner.ui.auth

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Partner
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.str
import com.sukobin.core.push.Push
import com.sukobin.core.push.PushPermission
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivityOtpBinding
import com.sukobin.partner.ui.main.MainActivity
import kotlinx.coroutines.launch

class OtpActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PHONE = "phone"
        const val EXTRA_MODE = "mode"
        const val EXTRA_NAME = "name"
        const val EXTRA_VEHICLE = "vehicle"
        const val EXTRA_DEV_OTP = "devOtp"
        const val MODE_LOGIN = "login"
        const val MODE_REGISTER = "register"
        private const val RESEND_SECONDS = 30
    }

    private lateinit var b: ActivityOtpBinding
    private lateinit var boxes: List<EditText>
    private var busy = false
    private var timer: CountDownTimer? = null
    // Registered eagerly at construction: registerForActivityResult must be called
    // before the activity reaches STARTED, and a lazy first-touch inside the verify
    // coroutine throws IllegalStateException.
    private val pushPermission = PushPermission(this)

    private val phone by lazy { intent.getStringExtra(EXTRA_PHONE).orEmpty() }
    private val mode by lazy { intent.getStringExtra(EXTRA_MODE) ?: MODE_LOGIN }
    private val name by lazy { intent.getStringExtra(EXTRA_NAME).orEmpty() }
    private val vehicle by lazy { intent.getStringExtra(EXTRA_VEHICLE).orEmpty() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityOtpBinding.inflate(layoutInflater)
        setContentView(b.root)

        boxes = listOf(b.otp1, b.otp2, b.otp3, b.otp4, b.otp5, b.otp6)

        b.otpSubtitle.text = getString(R.string.otp_sub, "+91 $phone")
        b.btnBack.setOnClickListener { finish() }
        b.btnVerify.setOnClickListener { verify() }
        b.btnResend.setOnClickListener { resend() }

        wireBoxes()
        startResendTimer()

        val dev = intent.getStringExtra(EXTRA_DEV_OTP)
        if (!dev.isNullOrBlank() && dev.length == 6) {
            b.otpHint.visibility = View.VISIBLE
            b.otpHint.text = getString(R.string.otp_dev_hint, dev)
            dev.forEachIndexed { i, c -> boxes[i].setText(c.toString()) }
        } else {
            b.otpHint.visibility = View.GONE
        }

        boxes.first().requestFocus()
    }

    private fun wireBoxes() {
        boxes.forEachIndexed { index, box ->
            box.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    if ((s?.length ?: 0) == 1 && index < boxes.lastIndex) {
                        boxes[index + 1].requestFocus()
                    }
                    refreshButton()
                }
            })

            box.setOnKeyListener { _, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_DEL &&
                    event.action == KeyEvent.ACTION_DOWN &&
                    box.text.isEmpty() &&
                    index > 0
                ) {
                    boxes[index - 1].apply {
                        setText("")
                        requestFocus()
                    }
                    true
                } else false
            }
        }
    }

    private val code: String get() = boxes.joinToString("") { it.text.toString().trim() }

    private fun refreshButton() {
        val ready = code.length == 6
        b.btnVerify.background = ContextCompat.getDrawable(
            this,
            if (ready) com.sukobin.core.R.drawable.bg_button_dark_lg
            else com.sukobin.core.R.drawable.bg_button_disabled_lg
        )
        b.btnVerify.alpha = if (ready) 1f else 0.6f
    }

    private fun startResendTimer() {
        timer?.cancel()
        b.btnResend.isEnabled = false
        timer = object : CountDownTimer(RESEND_SECONDS * 1000L, 1000) {
            override fun onTick(msLeft: Long) {
                b.btnResend.text = getString(R.string.otp_resend_in, (msLeft / 1000).toInt())
            }

            override fun onFinish() {
                b.btnResend.isEnabled = true
                b.btnResend.setText(R.string.otp_resend)
            }
        }.start()
    }

    private fun resend() {
        lifecycleScope.launch {
            when (val r = apiCall { partnerSendOtp(jsonOf("phone" to phone)) }) {
                is ApiResult.Ok -> {
                    startResendTimer()
                    r.value.str("devOtp")?.let { dev ->
                        b.otpHint.visibility = View.VISIBLE
                        b.otpHint.text = getString(R.string.otp_dev_hint, dev)
                    }
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun verify() {
        if (busy) return

        if (code.length != 6) {
            toast(getString(R.string.otp_error_incomplete))
            return
        }

        setBusy(true)

        lifecycleScope.launch {
            val result = if (mode == MODE_REGISTER) {
                apiCall {
                    partnerRegister(
                        jsonOf(
                            "name" to name,
                            "vehicleNumber" to vehicle,
                            "phone" to phone,
                            "otp" to code
                        )
                    )
                }
            } else {
                apiCall { partnerLogin(jsonOf("phone" to phone, "otp" to code)) }
            }

            setBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    val body = result.value
                    val partner = body.decode<Partner>("partner")

                    Session.save(
                        token = body.str("token"),
                        id = partner?.id,
                        name = partner?.name ?: name,
                        phone = partner?.phone ?: phone,
                        role = "partner"
                    )

                    pushPermission.request()
                    Push.register(this@OtpActivity) { partnerSavePushToken(it) }

                    startActivity(
                        Intent(this@OtpActivity, MainActivity::class.java)
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
        b.verifySpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnVerify.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        timer?.cancel()
        super.onDestroy()
    }
}
