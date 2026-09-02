package com.sukobin.core.push

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.sukobin.core.R
import kotlin.random.Random

class SukobinMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Push.stashToken(this, token)
        Push.forget(this)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        Push.ensureChannel(this)

        val data = message.data
        val title = message.notification?.title ?: data["title"] ?: getString(R.string.push_default_title)
        val body = message.notification?.body ?: data["body"] ?: return

        show(title, body, data)
    }

    private fun show(title: String, body: String, data: Map<String, String>) {
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            data.forEach { (k, v) -> putExtra(k, v) }
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pending = launch?.let {
            PendingIntent.getActivity(this, Random.nextInt(), it, flags)
        }

        val builder = NotificationCompat.Builder(this, Push.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setColor(Color.parseColor("#1A3D2B"))
            .setAutoCancel(true)

        pending?.let { builder.setContentIntent(it) }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(
                android.net.Uri.parse("android.resource://$packageName/${R.raw.notification}")
            )
            builder.setVibrate(longArrayOf(0, 250, 200, 250))
        }

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(Random.nextInt(100000), builder.build())
    }
}
