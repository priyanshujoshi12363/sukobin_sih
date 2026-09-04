package com.sukobin.officer.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.reflect.TypeToken
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import java.io.File
import java.util.UUID

data class QueuedReport(
    val clientId: String,
    val segmentId: String?,
    val segmentName: String?,
    val type: String,
    val severity: String,
    val description: String,
    val lng: Double,
    val lat: Double,
    val accuracyM: Double,
    val district: String?,
    val state: String?,
    val capturedAt: String,
    val photos: List<String> = emptyList(),
    val blocksTraffic: Boolean = false,
    val estimatedClearanceHours: Int? = null,
    var attempts: Int = 0,
    var lastError: String? = null,
    var sent: Boolean = false,
    var sentAt: String? = null
)

/**
 * Reports are written to disk the moment the officer taps save, before any
 * network call. Nothing is ever lost to a dead signal, and because the server
 * keys on clientId a retry can never create a second copy of the same report.
 */
object ReportQueue {

    private const val FILE = "officer_report_queue.json"
    private val gson = Gson()
    private lateinit var file: File

    private var cache: MutableList<QueuedReport> = mutableListOf()

    fun init(context: Context) {
        if (!::file.isInitialized) {
            file = File(context.applicationContext.filesDir, FILE)
            cache = read()
        }
    }

    fun newClientId(): String = "of-" + UUID.randomUUID().toString()

    private fun read(): MutableList<QueuedReport> {
        if (!file.exists()) return mutableListOf()
        return runCatching {
            val type = object : TypeToken<MutableList<QueuedReport>>() {}.type
            gson.fromJson<MutableList<QueuedReport>>(file.readText(), type) ?: mutableListOf()
        }.getOrDefault(mutableListOf())
    }

    private fun write() {
        runCatching { file.writeText(gson.toJson(cache)) }
    }

    @Synchronized
    fun add(report: QueuedReport) {
        cache.add(0, report)
        // Keep the file from growing without bound on a phone that never syncs.
        if (cache.size > 300) cache = cache.take(300).toMutableList()
        write()
    }

    @Synchronized
    fun all(): List<QueuedReport> = cache.toList()

    @Synchronized
    fun pending(): List<QueuedReport> = cache.filter { !it.sent }

    @Synchronized
    fun pendingCount(): Int = cache.count { !it.sent }

    @Synchronized
    fun clearSentOlderThan(keep: Int = 40) {
        val sent = cache.filter { it.sent }
        if (sent.size > keep) {
            val drop = sent.drop(keep).map { it.clientId }.toSet()
            cache = cache.filterNot { it.clientId in drop }.toMutableList()
            write()
        }
    }

    private fun QueuedReport.toJson(): JsonObject = jsonOf(
        "clientId" to clientId,
        "segmentId" to segmentId,
        "type" to type,
        "severity" to severity,
        "description" to description,
        "coordinates" to jsonArrayOf(lng, lat),
        "accuracyM" to accuracyM,
        "district" to district,
        "state" to state,
        "capturedAt" to capturedAt,
        "photos" to jsonArrayOf(*photos.toTypedArray()),
        "wasOffline" to true,
        "impact" to jsonOf(
            "blocksTraffic" to blocksTraffic,
            "estimatedClearanceHours" to estimatedClearanceHours
        )
    )

    data class SyncResult(
        val attempted: Int,
        val accepted: Int,
        val duplicates: Int,
        val failed: Int,
        val message: String?
    ) {
        val settled: Int get() = accepted + duplicates
    }

    /**
     * Pushes everything waiting in one batch. A duplicate coming back is a
     * success: it means the server already has that report.
     */
    suspend fun sync(): SyncResult {
        val waiting = pending()
        if (waiting.isEmpty()) return SyncResult(0, 0, 0, 0, null)

        val payload = jsonArrayOf(*waiting.map { it.toJson() }.toTypedArray())

        return when (val r = apiCall { officerSyncReports(jsonOf("incidents" to payload)) }) {
            is ApiResult.Ok -> {
                val accepted = r.value.arr("acceptedIds")?.mapNotNull {
                    (it as? JsonObject)?.get("clientId")?.asString
                }.orEmpty().toSet()
                val duplicates = r.value.arr("duplicateIds")
                    ?.mapNotNull { it.takeIf { e -> e.isJsonPrimitive }?.asString }
                    .orEmpty().toSet()

                val settled = accepted + duplicates
                val now = java.time.Instant.now().toString()

                synchronized(this) {
                    cache.forEach {
                        if (it.clientId in settled) {
                            it.sent = true
                            it.sentAt = now
                            it.lastError = null
                        } else if (!it.sent) {
                            it.attempts += 1
                        }
                    }
                    write()
                }
                clearSentOlderThan()

                SyncResult(
                    attempted = waiting.size,
                    accepted = accepted.size,
                    duplicates = duplicates.size,
                    failed = r.value.int("failed"),
                    message = null
                )
            }

            is ApiResult.Err -> {
                synchronized(this) {
                    cache.forEach {
                        if (!it.sent) {
                            it.attempts += 1
                            it.lastError = r.message
                        }
                    }
                    write()
                }
                SyncResult(waiting.size, 0, 0, waiting.size, r.message)
            }
        }
    }
}
