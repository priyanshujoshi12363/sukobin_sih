package com.sukobin.partner.ui.auth

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivityWelcomeBinding

class WelcomeActivity : AppCompatActivity() {

    private lateinit var b: ActivityWelcomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityWelcomeBinding.inflate(layoutInflater)
        setContentView(b.root)

        step(b.step1.stepNumber, b.step1.stepTitle, b.step1.stepDetail, "1", R.string.welcome_step1_t, R.string.welcome_step1_d)
        step(b.step2.stepNumber, b.step2.stepTitle, b.step2.stepDetail, "2", R.string.welcome_step2_t, R.string.welcome_step2_d)
        step(b.step3.stepNumber, b.step3.stepTitle, b.step3.stepDetail, "3", R.string.welcome_step3_t, R.string.welcome_step3_d)

        b.btnRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        b.btnLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }
    }

    private fun step(
        number: android.widget.TextView,
        title: android.widget.TextView,
        detail: android.widget.TextView,
        n: String,
        titleRes: Int,
        detailRes: Int
    ) {
        number.text = n
        title.setText(titleRes)
        detail.setText(detailRes)
    }
}
