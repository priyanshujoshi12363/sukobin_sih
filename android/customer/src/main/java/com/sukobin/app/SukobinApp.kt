package com.sukobin.app

import android.app.Application
import com.sukobin.core.net.Session
import com.sukobin.core.ui.LanguagePicker

class SukobinApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Session.init(this)
        // Re-apply the saved language before any screen inflates.
        LanguagePicker.restore()
    }
}
