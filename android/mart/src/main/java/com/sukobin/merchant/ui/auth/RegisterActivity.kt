package com.sukobin.merchant.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Merchant
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.str
import com.sukobin.core.push.Push
import com.sukobin.core.push.PushPermission
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityRegisterBinding
import com.sukobin.merchant.ui.main.MainActivity
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var b: ActivityRegisterBinding
    private val pushPermission = PushPermission(this)
    private var busy = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.btnBack.setOnClickListener { finish() }
        b.btnSubmit.setOnClickListener { submit() }
        b.linkLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun submit() {
        if (busy) return

        val name = b.inputName.text.toString().trim()
        val business = b.inputBusiness.text.toString().trim()
        val phone = b.inputPhone.text.toString().trim()
        val email = b.inputEmail.text.toString().trim()
        val gst = b.inputGst.text.toString().trim()

        if (name.isEmpty() || business.isEmpty() || phone.length != 10) {
            toast(getString(R.string.reg_error))
            return
        }

        setBusy(true)

        lifecycleScope.launch {
            val result = apiCall {
                merchantRegister(
                    jsonOf(
                        "name" to name,
                        "businessName" to business,
                        "phone" to phone,
                        "email" to email.ifBlank { null },
                        "gstNumber" to gst.ifBlank { null }
                    )
                )
            }

            setBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    val body = result.value
                    val merchant = body.decode<Merchant>("merchant")

                    Session.save(
                        token = body.str("token"),
                        id = merchant?.id,
                        name = merchant?.name ?: name,
                        phone = merchant?.phone ?: phone,
                        role = "merchant"
                    )

                    pushPermission.request()
                    Push.register(this@RegisterActivity) { merchantSavePushToken(it) }

                    startActivity(
                        Intent(this@RegisterActivity, MainActivity::class.java)
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
        b.submitSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnSubmit.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
