package com.sukobin.officer.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.bool
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.str
import com.sukobin.core.ui.Motion
import com.sukobin.officer.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var b: ActivityLoginBinding
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.phoneInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val valid = (s?.length ?: 0) == 10
                b.btnContinue.isEnabled = valid
                b.btnContinue.alpha = if (valid) 1f else 0.45f
                b.errorLine.visibility = View.GONE
            }

            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
        })

        b.btnContinue.isEnabled = false
        b.btnContinue.alpha = 0.45f
        b.btnContinue.setOnClickListener { requestOtp() }
    }

    private fun requestOtp() {
        if (busy) return
        val phone = b.phoneInput.text.toString().trim()
        if (phone.length != 10) return

        setBusy(true)

        lifecycleScope.launch {
            when (val r = apiCall { officerSendOtp(jsonOf("phone" to phone)) }) {
                is ApiResult.Ok -> {
                    setBusy(false)
                    startActivity(
                        Intent(this@LoginActivity, OtpActivity::class.java)
                            .putExtra(OtpActivity.EXTRA_PHONE, phone)
                            .putExtra(OtpActivity.EXTRA_REGISTERED, r.value.bool("registered"))
                            .putExtra(OtpActivity.EXTRA_DEV_OTP, r.value.str("devOtp"))
                    )
                }

                is ApiResult.Err -> {
                    setBusy(false)
                    b.errorLine.text = r.message
                    b.errorLine.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        b.spinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnLabel.visibility = if (value) View.GONE else View.VISIBLE
        b.btnContinue.isClickable = !value
    }
}
