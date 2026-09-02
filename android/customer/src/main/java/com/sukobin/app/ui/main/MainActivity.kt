package com.sukobin.app.ui.main

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.commit
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding
    private val cache = mutableMapOf<Int, Fragment>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.bottomNav.setOnItemSelectedListener { item ->
            show(item.itemId)
            true
        }

        if (savedInstanceState == null) {
            b.bottomNav.selectedItemId = R.id.tab_home
        }
    }

    fun selectTab(itemId: Int) {
        b.bottomNav.selectedItemId = itemId
    }

    private fun show(itemId: Int) {
        val fragment = cache.getOrPut(itemId) { create(itemId) }
        supportFragmentManager.commit {
            setReorderingAllowed(true)
            replace(R.id.navHost, fragment)
        }
    }

    private fun create(itemId: Int): Fragment = when (itemId) {
        R.id.tab_parcel -> ListFragment.of(ListFragment.KIND_PARCELS)
        R.id.tab_orders -> ListFragment.of(ListFragment.KIND_ORDERS)
        R.id.tab_history -> ListFragment.of(ListFragment.KIND_HISTORY)
        R.id.tab_profile -> ProfileFragment()
        else -> HomeFragment()
    }
}
