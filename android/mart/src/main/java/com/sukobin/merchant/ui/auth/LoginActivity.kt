package com.sukobin.merchant.ui.auth

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityLoginBinding

class LoginActivity : AppCompatActivity() {

    private lateinit var b: ActivityLoginBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnBack.setOnClickListener { finish() }

        b.inputPhone.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) = refresh()
        })

        b.btnSubmit.setOnClickListener { submit() }

        b.linkRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }

        refresh()
    }

    private val phone: String get() = b.inputPhone.text.toString().trim()

    private fun refresh() {
        val ready = phone.length == 10
        b.btnSubmit.background = ContextCompat.getDrawable(
            this,
            if (ready) com.sukobin.core.R.drawable.bg_button_dark_lg
            else com.sukobin.core.R.drawable.bg_button_disabled_lg
        )
        b.btnSubmit.alpha = if (ready) 1f else 0.6f
    }

    private fun submit() {
        if (phone.length != 10) {
            Toast.makeText(this, R.string.login_error_phone, Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(
            Intent(this, OtpActivity::class.java)
                .putExtra(OtpActivity.EXTRA_PHONE, phone)
                .putExtra(OtpActivity.EXTRA_MODE, OtpActivity.MODE_LOGIN)
        )
    }
}
