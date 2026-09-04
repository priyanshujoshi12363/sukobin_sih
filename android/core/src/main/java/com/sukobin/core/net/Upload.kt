package com.sukobin.core.net

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * Turning a picked image Uri into something Retrofit can post. Content Uris
 * from the photo picker are not files, so the bytes are copied into the app's
 * cache first.
 */
object Upload {

    fun text(value: String?): RequestBody =
        (value ?: "").toRequestBody("text/plain".toMediaTypeOrNull())

    fun part(context: Context, uri: Uri, field: String): MultipartBody.Part? {
        val resolver = context.contentResolver
        val type = resolver.getType(uri) ?: "image/jpeg"
        val name = displayName(context, uri) ?: "upload_${System.currentTimeMillis()}.jpg"

        val copy = File(context.cacheDir, "up_${System.currentTimeMillis()}_$name")
        return try {
            resolver.openInputStream(uri)?.use { input ->
                copy.outputStream().use { output -> input.copyTo(output) }
            } ?: return null

            MultipartBody.Part.createFormData(
                field,
                name,
                copy.asRequestBody(type.toMediaTypeOrNull())
            )
        } catch (e: Exception) {
            null
        }
    }

    fun parts(context: Context, uris: List<Uri>, field: String): List<MultipartBody.Part> =
        uris.mapNotNull { part(context, it, field) }

    private fun displayName(context: Context, uri: Uri): String? =
        runCatching {
            context.contentResolver.query(uri, null, null, null, null)?.use { c ->
                val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (i >= 0 && c.moveToFirst()) c.getString(i) else null
            }
        }.getOrNull()

    /** Cache copies are only needed for the life of one upload. */
    fun clearCache(context: Context) {
        runCatching {
            context.cacheDir.listFiles()?.filter { it.name.startsWith("up_") }?.forEach { it.delete() }
        }
    }
}
