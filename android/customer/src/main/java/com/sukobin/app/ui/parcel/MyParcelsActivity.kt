package com.sukobin.app.ui.parcel

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.commit
import com.sukobin.app.R
import com.sukobin.app.databinding.ActivityContainerBinding
import com.sukobin.app.ui.main.ListFragment
import com.sukobin.core.ui.Motion

class MyParcelsActivity : AppCompatActivity() {

    private lateinit var b: ActivityContainerBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityContainerBinding.inflate(layoutInflater)
        setContentView(b.root)

        Motion.applyEnter(this)

        if (savedInstanceState == null) {
            supportFragmentManager.commit {
                setReorderingAllowed(true)
                replace(R.id.container, ListFragment.of(ListFragment.KIND_PARCELS))
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
