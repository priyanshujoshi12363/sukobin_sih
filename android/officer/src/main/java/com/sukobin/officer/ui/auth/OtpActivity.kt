package com.sukobin.officer.ui.auth

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.ui.Motion
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.databinding.ActivityOtpBinding
import com.sukobin.officer.ui.main.MainActivity
import kotlinx.coroutines.launch

class OtpActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PHONE = "phone"
        const val EXTRA_REGISTERED = "registered"
        const val EXTRA_DEV_OTP = "devOtp"
    }

    private lateinit var b: ActivityOtpBinding
    private lateinit var boxes: List<EditText>

    private var phone: String = ""
    private var busy = false
    private var timer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityOtpBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        phone = intent.getStringExtra(EXTRA_PHONE).orEmpty()
        b.subtitle.text = "Sent to +91 $phone"
        b.btnBack.setOnClickListener { finish() }

        boxes = listOf(b.otp1, b.otp2, b.otp3, b.otp4, b.otp5, b.otp6)
        wireBoxes()

        intent.getStringExtra(EXTRA_DEV_OTP)?.takeIf { it.length == 6 }?.let { code ->
            b.devHint.visibility = View.VISIBLE
            b.devHint.text = "Demo mode - your code is $code"
            code.forEachIndexed { i, c -> boxes[i].setText(c.toString()) }
        }

        b.btnVerify.setOnClickListener { submit() }
        b.btnResend.setOnClickListener { resend() }
        startTimer()
    }

    private fun wireBoxes() {
        boxes.forEachIndexed { index, box ->
            box.addTextChangedListener(object : TextWatcher {
                override fun afterTextChanged(s: Editable?) {
                    if ((s?.length ?: 0) == 1 && index < boxes.lastIndex) {
                        boxes[index + 1].requestFocus()
                    }
                    b.errorLine.visibility = View.GONE
                    val full = boxes.all { it.text.length == 1 }
                    b.btnVerify.isEnabled = full
                    b.btnVerify.alpha = if (full) 1f else 0.45f
                    if (full) submit()
                }

                override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            })

            box.setOnKeyListener { _, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_DEL &&
                    event.action == KeyEvent.ACTION_DOWN &&
                    box.text.isEmpty() && index > 0
                ) {
                    boxes[index - 1].requestFocus()
                    boxes[index - 1].setText("")
                    true
                } else {
                    false
                }
            }
        }
        boxes.first().requestFocus()
    }

    private fun submit() {
        if (busy) return
        val otp = boxes.joinToString("") { it.text.toString() }
        if (otp.length != 6) return

        setBusy(true)

        lifecycleScope.launch {
            when (val r = apiCall { officerLogin(jsonOf("phone" to phone, "otp" to otp)) }) {
                is ApiResult.Ok -> {
                    val officer = r.value.obj("officer")
                    Session.save(
                        token = r.value.str("token"),
                        id = officer?.str("_id"),
                        name = officer?.str("name"),
                        phone = officer?.str("phone"),
                        role = "officer"
                    )
                    OfficerSession.store(officer)
                    setBusy(false)
                    goToMain()
                }

                is ApiResult.Err -> {
                    setBusy(false)
                    val needsRegistration =
                        r.body?.get("needsRegistration")?.takeIf { it.isJsonPrimitive }?.asBoolean == true

                    if (needsRegistration) {
                        startActivity(
                            Intent(this@OtpActivity, RegisterActivity::class.java)
                                .putExtra(RegisterActivity.EXTRA_PHONE, phone)
                        )
                        finish()
                    } else {
                        b.errorLine.text = r.message
                        b.errorLine.visibility = View.VISIBLE
                        boxes.forEach { it.setText("") }
                        boxes.first().requestFocus()
                    }
                }
            }
        }
    }

    private fun goToMain() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
    }

    private fun resend() {
        lifecycleScope.launch {
            when (val r = apiCall { officerSendOtp(jsonOf("phone" to phone)) }) {
                is ApiResult.Ok -> {
                    r.value.str("devOtp")?.takeIf { it.length == 6 }?.let { code ->
                        b.devHint.visibility = View.VISIBLE
                        b.devHint.text = "Demo mode - your code is $code"
                    }
                    startTimer()
                }

                is ApiResult.Err -> {
                    b.errorLine.text = r.message
                    b.errorLine.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun startTimer() {
        timer?.cancel()
        b.btnResend.isEnabled = false
        timer = object : CountDownTimer(30_000, 1000) {
            override fun onTick(ms: Long) {
                b.btnResend.text = "Resend in ${ms / 1000}s"
            }

            override fun onFinish() {
                b.btnResend.isEnabled = true
                b.btnResend.text = "Resend code"
            }
        }.start()
    }

    private fun setBusy(value: Boolean) {
        busy = value
        b.spinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnLabel.visibility = if (value) View.GONE else View.VISIBLE
        b.btnVerify.isClickable = !value
    }

    override fun onDestroy() {
        timer?.cancel()
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
