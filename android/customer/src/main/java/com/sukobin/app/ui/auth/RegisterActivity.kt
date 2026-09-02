package com.sukobin.app.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityRegisterBinding

class RegisterActivity : AppCompatActivity() {

    private lateinit var b: ActivityRegisterBinding
    private var termsAccepted = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnBack.setOnClickListener { finish() }

        b.inputPhone.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b2: Int, c: Int) {}
            override fun afterTextChanged(s: Editable?) = refreshButton()
        })

        b.checkboxTerms.setOnClickListener {
            termsAccepted = !termsAccepted
            b.checkboxBox.background = ContextCompat.getDrawable(
                this,
                if (termsAccepted) com.sukobin.core.R.drawable.bg_checkbox_on
                else com.sukobin.core.R.drawable.bg_checkbox_off
            )
            b.checkboxTick.visibility = if (termsAccepted) View.VISIBLE else View.GONE
            refreshButton()
        }

        b.btnSubmit.setOnClickListener { submit() }

        b.linkLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        refreshButton()
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
                .putExtra(OtpActivity.EXTRA_MODE, OtpActivity.MODE_REGISTER)
        )
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
