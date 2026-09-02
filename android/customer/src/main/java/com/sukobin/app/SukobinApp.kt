package com.sukobin.app

import android.app.Application
import com.sukobin.core.net.Session

class SukobinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Session.init(this)
    }
}
