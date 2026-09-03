package com.sukobin.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.core.ui.Motion
import androidx.core.content.ContextCompat
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var b: ActivityLoginBinding
    private var termsAccepted = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(b.root)

        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }

        b.inputPhone.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b2: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) = refreshButton()
        })

        applyCheckbox()

        b.checkboxTerms.setOnClickListener {
            termsAccepted = !termsAccepted
            applyCheckbox()
            refreshButton()
        }

        b.btnSubmit.setOnClickListener { submit() }

        b.linkRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }

        refreshButton()
    }

    private fun applyCheckbox() {
        b.checkboxBox.background = ContextCompat.getDrawable(
            this,
            if (termsAccepted) com.sukobin.core.R.drawable.bg_checkbox_on
            else com.sukobin.core.R.drawable.bg_checkbox_off
        )
        b.checkboxTick.visibility = if (termsAccepted) View.VISIBLE else View.GONE
    }

    private val phone: String get() = b.inputPhone.text.toString().trim()

    private val ready: Boolean get() = phone.length == 10 && termsAccepted

    private fun refreshButton() {
        b.btnSubmit.background = ContextCompat.getDrawable(
            this,
            if (ready) com.sukobin.core.R.drawable.bg_button_dark_lg
            else com.sukobin.core.R.drawable.bg_button_disabled_lg
        )
        b.btnSubmit.alpha = if (ready) 1f else 0.6f
    }

    private fun submit() {
        if (phone.length < 10) {
            toast(getString(R.string.login_error_phone))
            return
        }
        if (!termsAccepted) {
            toast(getString(R.string.login_error_terms))
            return
        }

        startActivity(
            Intent(this, OtpActivity::class.java)
                .putExtra(OtpActivity.EXTRA_PHONE, phone)
                .putExtra(OtpActivity.EXTRA_MODE, OtpActivity.MODE_LOGIN)
        )
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
