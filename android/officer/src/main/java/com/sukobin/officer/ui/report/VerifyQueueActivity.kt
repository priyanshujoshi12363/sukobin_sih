package com.sukobin.officer.ui.report

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.ui.Motion
import com.sukobin.officer.R
import com.sukobin.officer.databinding.ActivityVerifyQueueBinding
import com.sukobin.officer.databinding.ItemVerifyBinding
import com.sukobin.officer.ui.Status
import kotlinx.coroutines.launch

data class VerifyRow(
    val incidentId: String,
    val type: String,
    val severity: String,
    val description: String,
    val reporterName: String,
    val district: String?,
    val segmentId: String?,
    val capturedAt: String,
    val wasOffline: Boolean,
    val blocksTraffic: Boolean,
    val photos: List<String>
)

/**
 * Only STATE and REGION officers reach this screen. Confirming a report is what
 * turns one person's word into a road status the routing engine will act on, so
 * it always asks first.
 */
class VerifyQueueActivity : AppCompatActivity() {

    private lateinit var b: ActivityVerifyQueueBinding

    private val adapter = VerifyAdapter(
        onConfirm = { row -> decide(row, "VERIFIED") },
        onReject = { row -> decide(row, "REJECTED") },
        onPhoto = { url, caption ->
            startActivity(
                Intent(this, PhotoViewActivity::class.java)
                    .putExtra(PhotoViewActivity.EXTRA_URL, url)
                    .putExtra(PhotoViewActivity.EXTRA_CAPTION, caption)
            )
        }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityVerifyQueueBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.queueList.layoutManager = LinearLayoutManager(this)
        b.queueList.adapter = adapter
        b.swipe.setOnRefreshListener { load() }
        b.btnRetry.setOnClickListener { load() }

        load()
    }

    private fun load() {
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { officerVerifyQueue() }) {
                is ApiResult.Ok -> {
                    b.swipe.isRefreshing = false
                    val rows = r.value.arr("pending")?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        VerifyRow(
                            incidentId = o.get("incidentId")?.asString ?: return@mapNotNull null,
                            type = o.get("type")?.asString ?: "OTHER",
                            severity = o.get("severity")?.asString ?: "MEDIUM",
                            description = o.get("description")?.takeIf { !it.isJsonNull }?.asString.orEmpty(),
                            reporterName = o.get("reporterName")?.takeIf { !it.isJsonNull }?.asString
                                ?: getString(R.string.profile_field_officer),
                            district = o.get("district")?.takeIf { !it.isJsonNull }?.asString,
                            segmentId = o.get("segmentId")?.takeIf { !it.isJsonNull }?.asString,
                            capturedAt = o.get("capturedAt")?.asString.orEmpty(),
                            wasOffline = o.get("wasOffline")?.takeIf { !it.isJsonNull }?.asBoolean ?: false,
                            blocksTraffic = o.get("blocksTraffic")?.takeIf { !it.isJsonNull }?.asBoolean ?: false,
                            photos = o.getAsJsonArray("photos")?.mapNotNull { it.asString }.orEmpty()
                        )
                    }.orEmpty()

                    adapter.submitList(rows)
                    b.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
                    b.countLine.text = getString(R.string.verify_waiting_count, rows.size)
                }

                is ApiResult.Err -> {
                    b.swipe.isRefreshing = false
                    b.errorState.visibility = View.VISIBLE
                    b.errorText.text = r.message
                }
            }
        }
    }

    private fun decide(row: VerifyRow, status: String) {
        val confirming = status == "VERIFIED"
        val title = if (confirming) R.string.verify_confirm_title else R.string.verify_reject_title
        val message = if (confirming) R.string.verify_confirm_body else R.string.verify_reject_body

        val input = android.widget.EditText(this).apply {
            hint = getString(R.string.verify_note_hint)
            setPadding(48, 32, 48, 32)
        }

        AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(message)
            .setView(input)
            .setNegativeButton(R.string.common_cancel, null)
            .setPositiveButton(if (confirming) R.string.verify_confirm else R.string.verify_reject) { _, _ ->
                submit(row, status, input.text.toString().trim())
            }
            .show()
    }

    private fun submit(row: VerifyRow, status: String, note: String) {
        lifecycleScope.launch {
            val r = apiCall {
                officerVerifyIncident(row.incidentId, jsonOf("status" to status, "note" to note))
            }

            when (r) {
                is ApiResult.Ok -> {
                    val newStatus = r.value.obj("segment")?.str("status")
                    val text = if (newStatus != null) {
                        getString(
                            R.string.verify_done_status,
                            Status.label(this@VerifyQueueActivity, newStatus)
                        )
                    } else {
                        getString(R.string.verify_done)
                    }
                    Toast.makeText(this@VerifyQueueActivity, text, Toast.LENGTH_LONG).show()
                    load()
                }

                is ApiResult.Err ->
                    Toast.makeText(this@VerifyQueueActivity, r.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}

class VerifyAdapter(
    private val onConfirm: (VerifyRow) -> Unit,
    private val onReject: (VerifyRow) -> Unit,
    private val onPhoto: (String, String) -> Unit = { _, _ -> }
) : ListAdapter<VerifyRow, VerifyAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<VerifyRow>() {
            override fun areItemsTheSame(a: VerifyRow, b: VerifyRow) = a.incidentId == b.incidentId
            override fun areContentsTheSame(a: VerifyRow, b: VerifyRow) = a == b
        }
    }

    inner class VH(val b: ItemVerifyBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemVerifyBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val row = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.reportType.text = Status.typeLabel(ctx, row.type)
        b.reportSeverity.text = Status.severityLabel(ctx, row.severity)
        b.reportSeverity.setTextColor(ContextCompat.getColor(ctx, Status.severityColor(row.severity)))

        b.reportDesc.text = row.description
        b.reportDesc.visibility = if (row.description.isBlank()) View.GONE else View.VISIBLE

        b.reportMeta.text = buildString {
            append(row.reporterName)
            row.district?.let { append("  ·  $it") }
            if (row.wasOffline) append("  ·  " + ctx.getString(R.string.verify_offline_late))
        }

        b.reportRoad.text = row.segmentId ?: ctx.getString(R.string.verify_no_road)
        b.blocksTag.visibility = if (row.blocksTraffic) View.VISIBLE else View.GONE
        b.photoTag.visibility = if (row.photos.isEmpty()) View.GONE else View.VISIBLE
        b.photoTag.text = ctx.resources.getQuantityString(
            R.plurals.photo_count, row.photos.size, row.photos.size
        )

        // The photo is the evidence. Show it here rather than making the officer
        // take the reporter's word and go and look.
        val slots = listOf(b.vPhoto1, b.vPhoto2, b.vPhoto3)
        b.photoStrip.visibility = if (row.photos.isEmpty()) View.GONE else View.VISIBLE

        slots.forEachIndexed { i, view ->
            val url = row.photos.getOrNull(i)
            view.visibility = if (url == null) View.GONE else View.VISIBLE
            if (url != null) {
                view.load(url) { crossfade(true) }
                view.setOnClickListener {
                    onPhoto(url, ctx.getString(R.string.verify_photo_from, row.reporterName))
                }
            }
        }

        b.btnConfirm.setOnClickListener { onConfirm(row) }
        b.btnReject.setOnClickListener { onReject(row) }
    }
}
