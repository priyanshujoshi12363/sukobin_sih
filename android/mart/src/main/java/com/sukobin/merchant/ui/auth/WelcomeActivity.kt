package com.sukobin.merchant.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityWelcomeBinding

class WelcomeActivity : AppCompatActivity() {

    private lateinit var b: ActivityWelcomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityWelcomeBinding.inflate(layoutInflater)
        setContentView(b.root)

        step(b.step1.stepNumber, b.step1.stepTitle, b.step1.stepDetail, "1", R.string.welcome_f1_t, R.string.welcome_f1_d)
        step(b.step2.stepNumber, b.step2.stepTitle, b.step2.stepDetail, "2", R.string.welcome_f2_t, R.string.welcome_f2_d)
        step(b.step3.stepNumber, b.step3.stepTitle, b.step3.stepDetail, "3", R.string.welcome_f3_t, R.string.welcome_f3_d)

        b.btnRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
        b.btnLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
        }
    }

    private fun step(n: TextView, t: TextView, d: TextView, num: String, tRes: Int, dRes: Int) {
        n.text = num
        t.setText(tRes)
        d.setText(dRes)
    }
}
