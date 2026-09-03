package com.sukobin.app.ui.main

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.fragment.app.commit
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_TAB = "tab"
        const val TAB_HOME = "home"
        const val TAB_ORDERS = "orders"
    }

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
            b.bottomNav.selectedItemId = tabFor(intent.getStringExtra(EXTRA_TAB))
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_TAB)?.let { b.bottomNav.selectedItemId = tabFor(it) }
    }

    fun selectTab(itemId: Int) {
        b.bottomNav.selectedItemId = itemId
    }

    private fun tabFor(tab: String?): Int = when (tab) {
        TAB_ORDERS -> R.id.tab_orders
        else -> R.id.tab_home
    }

    private fun show(fragment: Fragment) {
        supportFragmentManager.commit {
            setReorderingAllowed(true)
            replace(R.id.navHost, fragment)
        }
    }

    private fun create(itemId: Int): Fragment = when (itemId) {
        R.id.tab_parcel -> com.sukobin.app.ui.parcel.ParcelFragment()
        R.id.tab_orders -> ListFragment.of(ListFragment.KIND_ORDERS)
        R.id.tab_history -> ListFragment.of(ListFragment.KIND_HISTORY)
        R.id.tab_profile -> ProfileFragment()
        else -> HomeFragment()
    }
}
