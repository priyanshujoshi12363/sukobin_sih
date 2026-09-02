package com.sukobin.partner.ui.main

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.commit
import com.sukobin.partner.R
import com.sukobin.partner.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private val cache = mutableMapOf<Int, Fragment>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.bottomNav.setOnItemSelectedListener { item ->
            show(cache.getOrPut(item.itemId) { create(item.itemId) })
            true
        }

        if (savedInstanceState == null) {
            b.bottomNav.selectedItemId = R.id.tab_home
        }
    }

    fun openHistory() {
        supportFragmentManager.commit {
            setReorderingAllowed(true)
            replace(R.id.navHost, HistoryFragment())
            addToBackStack("history")
        }
    }

    private fun show(fragment: Fragment) {
        supportFragmentManager.commit {
            setReorderingAllowed(true)
            replace(R.id.navHost, fragment)
        }
    }

    private fun create(itemId: Int): Fragment = when (itemId) {
        R.id.tab_stats -> StatsFragment()
        R.id.tab_profile -> ProfileFragment()
        else -> HomeFragment()
    }
}
