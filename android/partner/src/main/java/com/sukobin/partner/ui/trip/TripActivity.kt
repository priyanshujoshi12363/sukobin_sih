package com.sukobin.partner.ui.trip

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.DeliveryJob
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.jsonOf
import com.sukobin.core.ui.Motion
import com.sukobin.partner.R
import com.sukobin.partner.data.LocationReporter
import com.sukobin.partner.databinding.ActivityTripBinding
import com.sukobin.partner.databinding.ItemStopBinding
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * The working screen of a trip: the stops in order, pick up, then hand over
 * against the customer's code. Written for one hand at a roadside halt.
 */
class TripActivity : AppCompatActivity() {

    private lateinit var b: ActivityTripBinding

    private var jobs: List<TripStop> = emptyList()
    private var earned = 0.0
    private var delivered = 0
    private var startedWith = 0
    private var busy = false

    data class TripStop(
        val kind: String,
        val refId: String,
        val type: String,
        val fee: Double,
        val pickupLabel: String,
        val pickupPhone: String,
        val pickupLng: Double?,
        val pickupLat: Double?,
        val dropLabel: String,
        val dropPhone: String,
        val dropLng: Double?,
        val dropLat: Double?,
        var picked: Boolean
    )

    private val adapter = StopAdapter(
        onPickUp = { markPicked(it) },
        onDeliver = { askForCode(it) },
        onNavigate = { stop -> navigateTo(if (stop.picked) stop.dropLng to stop.dropLat else stop.pickupLng to stop.pickupLat) },
        onCall = { stop -> call(if (stop.picked) stop.dropPhone else stop.pickupPhone) }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityTripBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        b.btnBack.setOnClickListener { finish() }
        b.stopList.layoutManager = LinearLayoutManager(this)
        b.stopList.adapter = adapter
        b.swipe.setOnRefreshListener { load() }
        b.btnFindWork.setOnClickListener { finish() }
        b.btnDone.setOnClickListener { finish() }

        // The vehicle is moving with cargo, so this is exactly when the road
        // most needs sensing.
        LocationReporter.onTrip = true

        load()
    }

    private fun load() {
        b.loading.visibility = if (jobs.isEmpty()) View.VISIBLE else View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { partnerActiveTrip() }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    b.swipe.isRefreshing = false

                    val raw = r.value.decodeList<DeliveryJob>("jobs")
                    jobs = raw.map { j ->
                        TripStop(
                            kind = j.kind.ifBlank { "parcel" },
                            refId = j.refId,
                            type = j.type ?: "Parcel",
                            fee = j.fee,
                            pickupLabel = j.pickup?.label ?: "Pickup point",
                            pickupPhone = j.pickup?.phone.orEmpty(),
                            pickupLng = j.pickup?.coordinates?.getOrNull(0),
                            pickupLat = j.pickup?.coordinates?.getOrNull(1),
                            dropLabel = j.drop?.label ?: "Drop point",
                            dropPhone = j.drop?.phone.orEmpty(),
                            dropLng = j.drop?.coordinates?.getOrNull(0),
                            dropLat = j.drop?.coordinates?.getOrNull(1),
                            picked = j.picked
                        )
                    }

                    if (startedWith == 0) startedWith = jobs.size + delivered
                    render()
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    b.swipe.isRefreshing = false
                    toast(r.message)
                    render()
                }
            }
        }
    }

    private fun render() {
        adapter.submitList(jobs.toList())

        b.statEarned.text = "₹" + earned.roundToInt()
        b.statLeft.text = jobs.size.toString()
        b.statDelivered.text = delivered.toString()
        b.progressLine.text = getString(R.string.trip_progress, delivered, maxOf(startedWith, delivered))

        val nothingLeft = jobs.isEmpty()
        b.emptyState.visibility = if (nothingLeft && delivered == 0) View.VISIBLE else View.GONE
        b.doneState.visibility = if (nothingLeft && delivered > 0) View.VISIBLE else View.GONE
        b.stopList.visibility = if (nothingLeft) View.GONE else View.VISIBLE

        b.doneEarned.text = "₹" + earned.roundToInt()
        b.doneCount.text = delivered.toString()
    }

    private fun markPicked(stop: TripStop) {
        if (busy) return
        busy = true

        lifecycleScope.launch {
            val r = apiCall {
                partnerMarkPicked(jsonOf("kind" to stop.kind, "id" to stop.refId))
            }
            busy = false

            when (r) {
                is ApiResult.Ok -> {
                    jobs = jobs.map { if (it.refId == stop.refId) it.copy(picked = true) else it }
                    render()
                    toast(getString(R.string.trip_picked_up, stop.refId))
                }
                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    /**
     * Delivery is only accepted against the code the customer holds. That is
     * what stops a parcel being marked delivered from the road outside.
     */
    private fun askForCode(stop: TripStop) {
        val input = EditText(this).apply {
            hint = getString(R.string.trip_code_hint)
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setPadding(56, 40, 56, 40)
        }

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.trip_code_title))
            .setMessage(getString(R.string.trip_code_body, stop.dropLabel))
            .setView(input)
            .setNegativeButton(R.string.trip_cancel, null)
            .setPositiveButton(R.string.trip_confirm) { _, _ ->
                val code = input.text.toString().trim()
                if (code.length < 4) {
                    toast(getString(R.string.trip_code_short))
                } else {
                    deliver(stop, code)
                }
            }
            .show()
    }

    private fun deliver(stop: TripStop, code: String) {
        if (busy) return
        busy = true

        lifecycleScope.launch {
            val r = apiCall {
                partnerDeliver(jsonOf("kind" to stop.kind, "id" to stop.refId, "otp" to code))
            }
            busy = false

            when (r) {
                is ApiResult.Ok -> {
                    jobs = jobs.filterNot { it.refId == stop.refId }
                    delivered += 1
                    earned += stop.fee
                    render()
                    toast(getString(R.string.trip_delivered, stop.refId))
                    if (jobs.isEmpty()) LocationReporter.onTrip = false
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun navigateTo(coords: Pair<Double?, Double?>) {
        val (lng, lat) = coords
        if (lng == null || lat == null) {
            toast(getString(R.string.trip_no_location))
            return
        }
        val uri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving")
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (e: Exception) {
            toast(getString(R.string.trip_no_maps))
        }
    }

    private fun call(phone: String) {
        if (phone.isBlank()) {
            toast(getString(R.string.trip_no_phone))
            return
        }
        try {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
        } catch (e: Exception) {
            toast(getString(R.string.trip_no_phone))
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        if (jobs.isEmpty()) LocationReporter.onTrip = false
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}

class StopAdapter(
    private val onPickUp: (TripActivity.TripStop) -> Unit,
    private val onDeliver: (TripActivity.TripStop) -> Unit,
    private val onNavigate: (TripActivity.TripStop) -> Unit,
    private val onCall: (TripActivity.TripStop) -> Unit
) : ListAdapter<TripActivity.TripStop, StopAdapter.VH>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<TripActivity.TripStop>() {
            override fun areItemsTheSame(a: TripActivity.TripStop, b: TripActivity.TripStop) =
                a.refId == b.refId
            override fun areContentsTheSame(a: TripActivity.TripStop, b: TripActivity.TripStop) = a == b
        }
    }

    inner class VH(val b: ItemStopBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemStopBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        val s = getItem(position)
        val b = holder.b
        val ctx = b.root.context

        b.stopIndex.text = (position + 1).toString()
        b.stopRef.text = s.refId
        b.stopKind.text = if (s.kind == "order") "ORDER" else "PARCEL"
        b.stopFee.text = "₹" + s.fee.roundToInt()

        b.pickupLine.text = "▲  " + s.pickupLabel
        b.dropLine.text = "▼  " + s.dropLabel

        // Whichever leg is next is the one shown in strong type.
        b.pickupLine.alpha = if (s.picked) 0.45f else 1f
        b.dropLine.alpha = if (s.picked) 1f else 0.6f

        b.btnAction.text = ctx.getString(
            if (s.picked) R.string.trip_hand_over else R.string.trip_pick_up
        )
        b.btnAction.setOnClickListener { if (s.picked) onDeliver(s) else onPickUp(s) }

        b.btnNavigate.setOnClickListener { onNavigate(s) }
        b.btnCall.setOnClickListener { onCall(s) }
    }
}
