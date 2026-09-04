package com.sukobin.officer

import android.app.Application
import com.sukobin.core.net.Session
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.ReportQueue

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Session.init(this)
        OfficerSession.init(this)
        ReportQueue.init(this)
    }
}
