package com.sukobin.core.ui

import android.app.Activity
import android.os.Build
import android.view.View
import androidx.recyclerview.widget.RecyclerView
import com.sukobin.core.R

object Motion {

    fun applyEnter(activity: Activity) {
        overrideOpen(activity)
    }

    @Suppress("DEPRECATION")
    fun overrideOpen(activity: Activity) {
        if (Build.VERSION.SDK_INT >= 34) {
            activity.overrideActivityTransition(
                Activity.OVERRIDE_TRANSITION_OPEN,
                R.anim.slide_in_right,
                R.anim.slide_out_left
            )
            activity.overrideActivityTransition(
                Activity.OVERRIDE_TRANSITION_CLOSE,
                R.anim.slide_in_left,
                R.anim.slide_out_right
            )
        } else {
            activity.overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left)
        }
    }

    @Suppress("DEPRECATION")
    fun overrideClose(activity: Activity) {
        if (Build.VERSION.SDK_INT < 34) {
            activity.overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
        }
    }

    fun riseIn(recycler: RecyclerView) {
        recycler.layoutAnimation =
            android.view.animation.AnimationUtils.loadLayoutAnimation(
                recycler.context,
                R.anim.layout_rise
            )
    }

    fun replay(recycler: RecyclerView) {
        recycler.scheduleLayoutAnimation()
    }

    fun fadeIn(view: View, delay: Long = 0L, distance: Float = 18f) {
        view.alpha = 0f
        view.translationY = distance
        view.animate()
            .alpha(1f)
            .translationY(0f)
            .setStartDelay(delay)
            .setDuration(300)
            .start()
    }

    fun pop(view: View, scale: Float = 1.25f, duration: Long = 320) {
        view.animate()
            .scaleX(scale).scaleY(scale)
            .setDuration(duration / 2)
            .withEndAction {
                view.animate().scaleX(1f).scaleY(1f).setDuration(duration / 2).start()
            }
            .start()
    }
}
