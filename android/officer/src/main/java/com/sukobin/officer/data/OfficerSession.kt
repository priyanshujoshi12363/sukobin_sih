package com.sukobin.officer.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.JsonObject
import com.sukobin.core.net.bool
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.officer.R

/**
 * The officer's rank and patch decide what the app is allowed to show and do,
 * so they are kept alongside the shared Session rather than re-fetched on
 * every screen.
 */
object OfficerSession {

    private const val PREFS = "sukobin_officer"
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        }
    }

    var designation: String?
        get() = prefs.getString("designation", null)
        private set(v) = prefs.edit().putString("designation", v).apply()

    var department: String?
        get() = prefs.getString("department", null)
        private set(v) = prefs.edit().putString("department", v).apply()

    var level: String
        get() = prefs.getString("level", "DISTRICT") ?: "DISTRICT"
        private set(v) = prefs.edit().putString("level", v).apply()

    var district: String?
        get() = prefs.getString("district", null)
        private set(v) = prefs.edit().putString("district", v).apply()

    var state: String?
        get() = prefs.getString("state", null)
        private set(v) = prefs.edit().putString("state", v).apply()

    var canVerify: Boolean
        get() = prefs.getBoolean("canVerify", false)
        private set(v) = prefs.edit().putBoolean("canVerify", v).apply()

    var language: String
        get() = prefs.getString("lang", "en") ?: "en"
        set(v) = prefs.edit().putString("lang", v).apply()

    /**
     * Takes a Context because the fallbacks are words the officer reads, and an
     * officer running the app in Assamese should not see them in English.
     */
    fun scopeLabel(context: Context): String = when (level) {
        "REGION" -> context.getString(R.string.profile_scope_region)
        "STATE" -> state ?: context.getString(R.string.scope_state_fallback)
        else -> district ?: context.getString(R.string.scope_district_fallback)
    }

    fun levelLabel(context: Context): String = context.getString(
        when (level) {
            "BLOCK" -> R.string.level_block
            "STATE" -> R.string.level_state
            "REGION" -> R.string.level_region
            else -> R.string.level_district
        }
    )

    fun store(officer: JsonObject?) {
        if (officer == null) return
        designation = officer.str("designation")
        department = officer.str("department")
        canVerify = officer.bool("canVerifyIncidents")
        officer.str("preferredLanguage")?.let { language = it }

        val j = officer.obj("jurisdiction")
        level = j?.str("level") ?: "DISTRICT"
        district = j?.str("district")
        state = j?.str("state")
    }

    fun clear() {
        val lang = language
        prefs.edit().clear().putString("lang", lang).apply()
    }
}
