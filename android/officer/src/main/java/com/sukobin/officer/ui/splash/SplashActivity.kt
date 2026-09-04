package com.sukobin.officer.ui.splash

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Intent
import android.os.Bundle
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.push.Push
import com.sukobin.officer.R
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.ActivitySplashBinding
import com.sukobin.officer.ui.auth.LoginActivity
import com.sukobin.officer.ui.main.MainActivity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {

    private lateinit var b: ActivitySplashBinding
    private var sweep: ValueAnimator? = null
    private var pulse: ValueAnimator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(b.root)

        playIntro()
        startSweep()
        startPulse()

        lifecycleScope.launch {
            val target = resolveDestination()
            delay(1900L)
            startActivity(Intent(this@SplashActivity, target))
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }
    }

    private fun playIntro() {
        val rings = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.ringOuter, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.ringOuter, "scaleX", 0.6f, 1f),
                ObjectAnimator.ofFloat(b.ringOuter, "scaleY", 0.6f, 1f),
                ObjectAnimator.ofFloat(b.ringInner, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.ringInner, "scaleX", 0.6f, 1f),
                ObjectAnimator.ofFloat(b.ringInner, "scaleY", 0.6f, 1f)
            )
            duration = 620
            interpolator = DecelerateInterpolator()
        }

        val logo = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.logoHolder, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.logoHolder, "scaleX", 0.7f, 1f),
                ObjectAnimator.ofFloat(b.logoHolder, "scaleY", 0.7f, 1f)
            )
            duration = 440
            interpolator = OvershootInterpolator(1.6f)
        }

        val text = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.brandName, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.brandName, "translationY", 12f, 0f),
                ObjectAnimator.ofFloat(b.brandTag, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.brandTag, "translationY", 12f, 0f)
            )
            duration = 420
            interpolator = DecelerateInterpolator()
        }

        AnimatorSet().apply {
            playSequentially(rings, logo, text)
            start()
        }
    }

    private fun startSweep() {
        b.progressTrack.post {
            val track = b.progressTrack.width.toFloat()
            val seg = b.progressSweep.width.toFloat()
            sweep = ValueAnimator.ofFloat(-seg, track).apply {
                duration = 1250
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
                addUpdateListener { b.progressSweep.translationX = it.animatedValue as Float }
                start()
            }
        }
    }

    private fun startPulse() {
        pulse = ValueAnimator.ofFloat(1f, 1.12f).apply {
            duration = 1600
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener {
                val v = it.animatedValue as Float
                b.ringOuter.scaleX = v
                b.ringOuter.scaleY = v
            }
            start()
        }
    }

    private suspend fun resolveDestination(): Class<*> {
        if (!Session.isLoggedIn) return LoginActivity::class.java

        b.statusLine.setText(R.string.splash_status_verify)

        return when (val res = apiCall { officerVerifySession() }) {
            is ApiResult.Ok -> {
                OfficerSession.store(res.value.obj("officer"))
                Push.register(this) { officerSavePushToken(it) }
                // Anything the officer saved with no signal goes up now.
                if (ReportQueue.pendingCount() > 0) {
                    b.statusLine.setText(R.string.splash_status_syncing)
                    ReportQueue.sync()
                }
                MainActivity::class.java
            }

            is ApiResult.Err -> {
                // A dead network must not sign the officer out; the app still
                // has to work standing on a blocked road with no bars.
                if (res.code == 0 || res.message == "No internet connection") {
                    b.statusLine.setText(R.string.splash_status_offline)
                    MainActivity::class.java
                } else {
                    Session.clear()
                    OfficerSession.clear()
                    LoginActivity::class.java
                }
            }
        }
    }

    override fun onDestroy() {
        sweep?.cancel()
        pulse?.cancel()
        super.onDestroy()
    }
}
