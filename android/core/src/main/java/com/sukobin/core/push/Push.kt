package com.sukobin.core.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.sukobin.core.R
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.SukobinApi
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonOf
import kotlinx.coroutines.tasks.await
import retrofit2.Response

object Push {

    const val CHANNEL_ID = "sukobin_alerts"
    const val CHANNEL_NAME = "Sukobin Alerts"
    private const val TAG = "SukobinPush"

    private const val PREFS = "sukobin_push"
    private const val KEY_SYNCED_TOKEN = "synced_token"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val sound = Uri.parse("android.resource://${context.packageName}/${R.raw.notification}")

        val attributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .build()

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Order, parcel and delivery updates"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 250, 200, 250)
            setSound(sound, attributes)
        }

        manager.createNotificationChannel(channel)
    }

    suspend fun currentToken(): String? = try {
        FirebaseMessaging.getInstance().token.await()
    } catch (e: Exception) {
        Log.w(TAG, "Could not fetch FCM token: ${e.message}")
        null
    }

    suspend fun register(
        context: Context,
        endpoint: suspend SukobinApi.(com.google.gson.JsonObject) -> Response<com.google.gson.JsonObject>
    ): Boolean {
        ensureChannel(context)

        if (!Session.isLoggedIn) return false

        val token = currentToken() ?: return false
        return sync(context, token, endpoint)
    }

    suspend fun sync(
        context: Context,
        token: String,
        endpoint: suspend SukobinApi.(com.google.gson.JsonObject) -> Response<com.google.gson.JsonObject>
    ): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getString(KEY_SYNCED_TOKEN, null) == token) return true

        val result = apiCall { endpoint(jsonOf("token" to token, "platform" to "android")) }

        return when (result) {
            is ApiResult.Ok -> {
                prefs.edit().putString(KEY_SYNCED_TOKEN, token).apply()
                Log.i(TAG, "FCM token registered")
                true
            }

            is ApiResult.Err -> {
                Log.w(TAG, "FCM token registration failed: ${result.message}")
                false
            }
        }
    }

    fun forget(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().remove(KEY_SYNCED_TOKEN).apply()
    }

    fun pendingToken(context: Context): String? =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString("pending_token", null)

    fun stashToken(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("pending_token", token).apply()
    }
}
