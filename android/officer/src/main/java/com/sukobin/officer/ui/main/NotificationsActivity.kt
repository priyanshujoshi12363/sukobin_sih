package com.sukobin.officer.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.ui.Motion
import com.sukobin.officer.R
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.databinding.ActivityNotificationsBinding
import com.sukobin.officer.databinding.ItemNotificationBinding
import com.sukobin.officer.ui.Status
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

data class NotificationRow(
    val id: String,
    val kind: String,
    val severity: String,
    val title: String,
    val body: String,
    val segmentId: String?,
    val segmentName: String?,
    val read: Boolean,
    val createdAt: String
)

/**
 * This app has no push channel. The alert engine writes a row per officer and
 * this screen is where it lands, so an alert can be read, kept and acted on
 * rather than swiped away from a lock screen.
 */
class NotificationsActivity : AppCompatActivity() {

    private lateinit var b: ActivityNotificationsBinding

    private var unreadOnly = false
    private var unread = 0

    private val adapter = NotificationAdapter(
        onClick = { row -> open(row) }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityNotificationsBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.notificationList.layoutManager = LinearLayoutManager(this)
        b.notificationList.adapter = adapter
        b.swipe.setOnRefreshListener { load() }
        b.btnRetry.setOnClickListener { load() }

        b.btnMarkAll.setOnClickListener { markAll() }
        b.filterToggle.setOnClickListener {
            unreadOnly = !unreadOnly
            b.filterToggle.text = getString(
                if (unreadOnly) R.string.notif_show_all else R.string.notif_show_unread
            )
            load()
        }

        load()
    }

    private fun load() {
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            val r = apiCall {
                officerNotifications(unreadOnly, OfficerSession.language)
            }

            b.swipe.isRefreshing = false

            when (r) {
                is ApiResult.Ok -> {
                    unread = r.value.int("unread")
                    val rows = r.value.arr("notifications")?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        NotificationRow(
                            id = o.get("id")?.asString ?: return@mapNotNull null,
                            kind = o.get("kind")?.asString.orEmpty(),
                            severity = o.get("severity")?.asString ?: "INFO",
                            title = o.get("title")?.asString.orEmpty(),
                            body = o.get("body")?.asString.orEmpty(),
                            segmentId = o.get("segmentId")?.takeIf { !it.isJsonNull }?.asString,
                            segmentName = o.get("segmentName")?.takeIf { !it.isJsonNull }?.asString,
                            read = o.get("read")?.asBoolean ?: false,
                            createdAt = o.get("createdAt")?.asString.orEmpty()
                        )
                    }.orEmpty()

                    adapter.submitList(rows)
                    b.emptyState.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE
                    b.emptyState.setText(
                        if (unreadOnly) R.string.notif_empty_unread else R.string.notif_empty
                    )
                    renderHeader(rows.size)
                }

                is ApiResult.Err -> {
                    if (adapter.itemCount == 0) {
                        b.errorState.visibility = View.VISIBLE
                        b.errorText.text = r.message
                    } else {
                        Toast.makeText(this@NotificationsActivity, r.message, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    private fun renderHeader(shown: Int) {
        b.countLine.text = if (unread > 0) {
            resources.getQuantityString(R.plurals.notif_unread, unread, unread)
        } else {
            getString(R.string.notif_all_read)
        }
        b.btnMarkAll.visibility = if (unread > 0) View.VISIBLE else View.GONE
        b.shownLine.text = getString(R.string.notif_showing, shown)
    }

    private fun open(row: NotificationRow) {
        if (!row.read) {
            lifecycleScope.launch {
                apiCall { officerMarkNotificationsRead(jsonOf("ids" to jsonArrayOf(row.id))) }
                load()
            }
        }

        // An alert about a road should take the officer to that road.
        if (row.segmentId != null) {
            startActivity(
                Intent(this, RoadDetailActivity::class.java)
                    .putExtra(RoadDetailActivity.EXTRA_SEGMENT_ID, row.segmentId)
                    .putExtra(RoadDetailActivity.EXTRA_NAME, row.segmentName.orEmpty())
            )
        }
    }

    private fun markAll() {
        lifecycleScope.launch {
            when (val r = apiCall { officerMarkNotificationsRead(jsonOf("all" to true)) }) {
                is ApiResult.Ok -> load()
                is ApiResult.Err ->
                    Toast.makeText(this@NotificationsActivity, r.message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}

class NotificationAdapter(private val onClick: (NotificationRow) -> Unit) :
    ListAdapter<NotificationRow, NotificationAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<NotificationRow>() {
            override fun areItemsTheSame(a: NotificationRow, b: NotificationRow) = a.id == b.id
            override fun areContentsTheSame(a: NotificationRow, b: NotificationRow) = a == b
        }

        private val TIME: DateTimeFormatter =
            DateTimeFormatter.ofPattern("d MMM, h:mm a").withZone(ZoneId.systemDefault())
    }

    inner class VH(val b: ItemNotificationBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemNotificationBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val n = getItem(position)
        val b = holder.b
        val ctx = b.root.context
        val tint = ContextCompat.getColor(ctx, Status.alertColor(n.severity))

        b.stripe.setBackgroundColor(tint)
        b.notifTitle.text = n.title
        b.notifBody.text = n.body
        b.notifBody.visibility = if (n.body.isBlank()) View.GONE else View.VISIBLE

        b.severityLabel.text = n.severity.lowercase().replaceFirstChar { it.uppercase() }
        b.severityLabel.setTextColor(tint)

        b.unreadDot.visibility = if (n.read) View.INVISIBLE else View.VISIBLE
        b.notifTitle.setTypeface(null, if (n.read) android.graphics.Typeface.NORMAL else android.graphics.Typeface.BOLD)
        b.root.alpha = if (n.read) 0.72f else 1f

        b.notifTime.text = runCatching { TIME.format(Instant.parse(n.createdAt)) }.getOrDefault("")
        b.notifRoad.text = n.segmentName.orEmpty()
        b.notifRoad.visibility = if (n.segmentName.isNullOrBlank()) View.GONE else View.VISIBLE

        b.root.setOnClickListener { onClick(n) }
    }
}
