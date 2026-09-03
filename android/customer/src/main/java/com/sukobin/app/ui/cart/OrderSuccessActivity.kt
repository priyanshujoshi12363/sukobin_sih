package com.sukobin.app.ui.cart

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.os.Bundle
import android.view.animation.OvershootInterpolator
import androidx.appcompat.app.AppCompatActivity
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityOrderSuccessBinding
import com.sukobin.app.ui.main.MainActivity
import kotlin.math.roundToInt

class OrderSuccessActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ORDER_ID = "orderId"
        const val EXTRA_AMOUNT = "amount"
    }

    private lateinit var b: ActivityOrderSuccessBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityOrderSuccessBinding.inflate(layoutInflater)
        setContentView(b.root)

        val orderId = intent.getStringExtra(EXTRA_ORDER_ID)
        val amount = intent.getDoubleExtra(EXTRA_AMOUNT, 0.0)

        b.orderRef.text = getString(R.string.success_order_id, orderId ?: "-")
        b.orderAmount.text = getString(R.string.success_amount, amount.roundToInt().toString())

        celebrate()

        b.btnViewOrders.setOnClickListener { goHome(MainActivity.TAB_ORDERS) }
        b.btnHome.setOnClickListener { goHome(MainActivity.TAB_HOME) }
    }

    private fun celebrate() {
        AnimatorSet().apply {
            playTogether(
                ObjectAnimator.ofFloat(b.successBadge, "scaleX", 0.4f, 1f),
                ObjectAnimator.ofFloat(b.successBadge, "scaleY", 0.4f, 1f),
                ObjectAnimator.ofFloat(b.successBadge, "alpha", 0f, 1f)
            )
            duration = 520
            interpolator = OvershootInterpolator(2f)
            start()
        }

        ObjectAnimator.ofFloat(b.successTitle, "alpha", 0f, 1f).apply {
            duration = 400
            startDelay = 220
            start()
        }
    }

    private fun goHome(tab: String) {
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_TAB, tab)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        )
        finish()
    }
}
