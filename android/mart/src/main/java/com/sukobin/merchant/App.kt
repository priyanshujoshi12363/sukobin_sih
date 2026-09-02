package com.sukobin.merchant

import android.app.Application
import com.sukobin.core.net.Session

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Session.init(this)
    }
}
