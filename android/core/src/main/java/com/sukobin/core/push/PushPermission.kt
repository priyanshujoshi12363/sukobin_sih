package com.sukobin.core.push

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class PushPermission(private val activity: AppCompatActivity) {

    private var onResult: ((Boolean) -> Unit)? = null

    private val launcher = activity.registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> onResult?.invoke(granted) }

    fun granted(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            activity, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun request(callback: ((Boolean) -> Unit)? = null) {
        if (granted()) {
            callback?.invoke(true)
            return
        }
        onResult = callback
        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
