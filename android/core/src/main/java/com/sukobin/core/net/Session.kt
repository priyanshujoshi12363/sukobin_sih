package com.sukobin.core.net

import android.content.Context
import android.content.SharedPreferences

object Session {

    private const val PREFS = "sukobin_session"
    private const val KEY_TOKEN = "userToken"
    private const val KEY_ROLE = "role"
    private const val KEY_NAME = "name"
    private const val KEY_PHONE = "phone"
    private const val KEY_ID = "id"
    private const val KEY_LANG = "lang"
    private const val KEY_ADDRESS = "address"

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        if (!::prefs.isInitialized) {
            prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        }
    }

    var token: String?
        get() = prefs.getString(KEY_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var role: String?
        get() = prefs.getString(KEY_ROLE, null)
        set(value) = prefs.edit().putString(KEY_ROLE, value).apply()

    var name: String?
        get() = prefs.getString(KEY_NAME, null)
        set(value) = prefs.edit().putString(KEY_NAME, value).apply()

    var phone: String?
        get() = prefs.getString(KEY_PHONE, null)
        set(value) = prefs.edit().putString(KEY_PHONE, value).apply()

    var userId: String?
        get() = prefs.getString(KEY_ID, null)
        set(value) = prefs.edit().putString(KEY_ID, value).apply()

    var address: String?
        get() = prefs.getString(KEY_ADDRESS, null)
        set(value) = prefs.edit().putString(KEY_ADDRESS, value).apply()

    var language: String
        get() = prefs.getString(KEY_LANG, "en") ?: "en"
        set(value) = prefs.edit().putString(KEY_LANG, value).apply()

    val isLoggedIn: Boolean
        get() = !token.isNullOrBlank()

    fun save(token: String?, id: String?, name: String?, phone: String?, role: String?) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_ID, id)
            .putString(KEY_NAME, name)
            .putString(KEY_PHONE, phone)
            .putString(KEY_ROLE, role)
            .apply()
    }

    fun clear() {
        val lang = language
        prefs.edit().clear().putString(KEY_LANG, lang).apply()
    }
}
