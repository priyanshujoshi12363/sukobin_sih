package com.sukobin.officer.ui.main

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.sukobin.officer.R
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.ActivityMainBinding
import com.sukobin.officer.ui.report.ReportActivity
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding

    private val home by lazy { HomeFragment() }
    private val roads by lazy { RoadsFragment() }
    private val forecast by lazy { ForecastFragment() }
    private val profile by lazy { ProfileFragment() }

    private var current: Fragment? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.bottomNav.setOnItemSelectedListener { item ->
            show(
                when (item.itemId) {
                    R.id.tab_roads -> roads
                    R.id.tab_forecast -> forecast
                    R.id.tab_profile -> profile
                    else -> home
                }
            )
            true
        }

        b.fabReport.setOnClickListener {
            startActivity(Intent(this, ReportActivity::class.java))
        }

        if (savedInstanceState == null) {
            b.bottomNav.selectedItemId = R.id.tab_home
            show(home)
        }
    }

    private fun show(fragment: Fragment) {
        if (current === fragment) return
        supportFragmentManager.beginTransaction()
            .setCustomAnimations(R.anim.fade_in_quick, R.anim.fade_out_quick)
            .replace(R.id.container, fragment)
            .commit()
        current = fragment
    }

    override fun onResume() {
        super.onResume()
        updateQueueBadge()
        // Coming back into signal is the natural moment to flush the queue.
        if (ReportQueue.pendingCount() > 0) {
            lifecycleScope.launch {
                ReportQueue.sync()
                updateQueueBadge()
                (current as? Refreshable)?.refresh()
            }
        }
    }

    fun updateQueueBadge() {
        val pending = ReportQueue.pendingCount()
        val badge = b.bottomNav.getOrCreateBadge(R.id.tab_profile)
        badge.isVisible = pending > 0
        badge.number = pending
    }

    interface Refreshable {
        fun refresh()
    }
}
