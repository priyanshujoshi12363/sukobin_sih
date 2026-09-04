package com.sukobin.merchant.ui.main

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.ActivityMainBinding

/**
 * Five tabs, matching the Expo app: what needs doing now, orders, the
 * catalogue, how the shop is performing, and the shop itself.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var b: ActivityMainBinding

    private val home by lazy { HomeFragment() }
    private val orders by lazy { OrdersFragment() }
    private val products by lazy { ProductsFragment() }
    private val analytics by lazy { AnalyticsFragment() }
    private val profile by lazy { ProfileFragment() }

    private var current: Fragment? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityMainBinding.inflate(layoutInflater)
        setContentView(b.root)

        b.bottomNav.setOnItemSelectedListener { item ->
            show(
                when (item.itemId) {
                    R.id.tab_orders -> orders
                    R.id.tab_products -> products
                    R.id.tab_analytics -> analytics
                    R.id.tab_profile -> profile
                    else -> home
                }
            )
            true
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

    fun openTab(itemId: Int) {
        b.bottomNav.selectedItemId = itemId
    }

    /** An order waiting to be accepted should be visible from any tab. */
    fun setOrderBadge(count: Int) {
        val badge = b.bottomNav.getOrCreateBadge(R.id.tab_orders)
        badge.isVisible = count > 0
        badge.number = count
    }

    interface Refreshable {
        fun refresh()
    }
}
