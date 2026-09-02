package com.sukobin.merchant.ui.splash

import android.animation.Animator
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
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivitySplashBinding
import com.sukobin.merchant.ui.auth.WelcomeActivity
import com.sukobin.merchant.ui.main.MainActivity
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonOf
import com.sukobin.core.push.Push
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SplashActivity : AppCompatActivity() {

    private lateinit var b: ActivitySplashBinding
    private var sweepAnimator: ValueAnimator? = null
    private var pulseAnimator: ValueAnimator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(b.root)

        playIntro()
        startSweep()
        startPulse()

        lifecycleScope.launch {
            val destination = resolveDestination()
            delay(minOf(2200L, 2200L))
            goTo(destination)
        }
    }

    private fun playIntro() {
        val ringOuter = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.ringOuter, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.ringOuter, "scaleX", 0.6f, 1f),
                ObjectAnimator.ofFloat(b.ringOuter, "scaleY", 0.6f, 1f)
            )
            duration = 600
            interpolator = DecelerateInterpolator()
        }

        val ringInner = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.ringInner, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.ringInner, "scaleX", 0.6f, 1f),
                ObjectAnimator.ofFloat(b.ringInner, "scaleY", 0.6f, 1f)
            )
            duration = 500
            startDelay = 80
            interpolator = DecelerateInterpolator()
        }

        val logo = AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.logoHolder, "alpha", 0f, 1f),
                ObjectAnimator.ofFloat(b.logoHolder, "scaleX", 0.7f, 1f),
                ObjectAnimator.ofFloat(b.logoHolder, "scaleY", 0.7f, 1f)
            )
            duration = 460
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

        val bar = ObjectAnimator.ofFloat(b.progressTrack, "alpha", 0f, 1f).apply {
            duration = 300
        }

        AnimatorSet().apply {
            playSequentially(
                AnimatorSet().apply { playTogether(ringOuter, ringInner) },
                logo,
                text,
                bar
            )
            start()
        }
    }

    private fun startSweep() {
        b.progressTrack.post {
            val track = b.progressTrack.width.toFloat()
            val seg = b.progressSweep.width.toFloat()
            sweepAnimator = ValueAnimator.ofFloat(-seg, track).apply {
                duration = 1300
                repeatCount = ValueAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
                addUpdateListener { b.progressSweep.translationX = it.animatedValue as Float }
                start()
            }
        }
    }

    private fun startPulse() {
        pulseAnimator = ValueAnimator.ofFloat(1f, 1.12f).apply {
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
        if (!Session.isLoggedIn) return WelcomeActivity::class.java

        b.statusLine.setText(R.string.splash_status_verify)

        return when (val res = apiCall { merchantMe() }) {
            is ApiResult.Ok -> {
                Push.register(this) { merchantSavePushToken(it) }
                MainActivity::class.java
            }
            is ApiResult.Err -> {
                if (res.message == "No internet connection") {
                    b.statusLine.setText(R.string.splash_status_offline)
                    MainActivity::class.java
                } else {
                    Session.clear()
                    WelcomeActivity::class.java
                }
            }
        }
    }

    private fun goTo(target: Class<*>) {
        startActivity(Intent(this, target))
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    override fun onDestroy() {
        sweepAnimator?.cancel()
        pulseAnimator?.cancel()
        super.onDestroy()
    }
}
