package com.sukobin.partner.ui.main

import android.content.res.ColorStateList
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.ArrayAdapter
import android.widget.AutoCompleteTextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.DeliveryJob
import com.sukobin.core.net.Partner
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.bool
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.core.net.int
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import androidx.activity.result.contract.ActivityResultContracts
import android.content.Intent
import com.sukobin.partner.R
import com.sukobin.partner.data.LocationReporter
import com.sukobin.partner.ui.report.ReportHazardActivity
import com.sukobin.partner.ui.trip.TripActivity
import com.sukobin.partner.databinding.FragmentHomeBinding
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class HomeFragment : Fragment() {

    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!
    private lateinit var adapter: JobAdapter

    private var capacity = 1
    private var online = false

    private var fromTown: Town? = null
    private var toTown: Town? = null

    private val selected = linkedSetOf<String>()
    private var jobs: List<DeliveryJob> = emptyList()

    private var suggestJob: Job? = null
    private var busy = false

    // Built eagerly: registerForActivityResult throws if it is created after
    // the fragment has started.
    private val locationPermission = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.any { it }) startSensing() else renderSensingState()
    }

    data class Town(val label: String, val lng: Double, val lat: Double)

    override fun onCreateView(
        inflater: android.view.LayoutInflater,
        container: android.view.ViewGroup?,
        savedInstanceState: Bundle?
    ): android.view.View {
        _b = FragmentHomeBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: android.view.View, savedInstanceState: Bundle?) {

        b.greeting.text = getString(R.string.home_greeting, Session.name ?: "driver")

        adapter = JobAdapter(
            isSelected = { selected.contains(key(it)) },
            canSelectMore = { selected.size < capacity },
            onToggle = { toggle(it) }
        )
        b.jobsList.layoutManager = LinearLayoutManager(requireContext())
        b.jobsList.adapter = adapter

        b.onlineSwitch.setOnCheckedChangeListener { view, checked ->
            if (view.isPressed) setOnline(checked)
        }

        b.btnFind.setOnClickListener { findJobs() }
        b.btnStartTrip.setOnClickListener { startTrip() }

        wireAutocomplete(b.inputFrom) { fromTown = it }
        wireAutocomplete(b.inputTo) { toTown = it }

        b.btnReportHazard.setOnClickListener {
            startActivity(Intent(requireContext(), ReportHazardActivity::class.java))
        }

        b.btnOpenTrip.setOnClickListener {
            startActivity(Intent(requireContext(), TripActivity::class.java))
        }

        // The server tells us which road each fix matched, so the driver can
        // see the sensing is real rather than being asked to trust it.
        LocationReporter.onRoadUpdate = { name, status -> showRoad(name, status) }

        loadProfile()
        checkActiveTrip()
    }

    override fun onResume() {
        super.onResume()
        checkActiveTrip()
    }

    private fun checkActiveTrip() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val r = apiCall { partnerActiveTrip() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val n = r.value.arr("jobs")?.size() ?: 0
                    b.btnOpenTrip.visibility = if (n > 0) View.VISIBLE else View.GONE
                    b.openTripLabel.text = resources.getQuantityString(
                        R.plurals.home_stops_left, n, n
                    )
                }
                is ApiResult.Err -> Unit
            }
        }
    }

    private fun key(j: DeliveryJob) = "${j.kind}:${j.refId}"

    private fun loadProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val r = apiCall { partnerMe() }) {
                is ApiResult.Ok -> {
                    val partner = r.value.decode<Partner>("partner")
                    partner?.let {
                        capacity = it.capacity.coerceAtLeast(1)
                        online = it.isOnline
                        b.greeting.text = getString(R.string.home_greeting, it.name ?: "driver")
                        b.vehicleLine.text = listOfNotNull(
                            it.vehicleNumber,
                            it.vehicleType?.replaceFirstChar { c -> c.uppercase() },
                            "capacity $capacity"
                        ).joinToString("   ")
                        b.onlineSwitch.isChecked = online
                        renderOnlineState()
                        if (online) startSensing()
                        renderSensingState()
                    }
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun startSensing() {
        if (!LocationReporter.hasPermission(requireContext())) {
            locationPermission.launch(
                arrayOf(
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
            return
        }
        LocationReporter.start(requireContext())
        renderSensingState()
    }

    private fun renderSensingState() {
        if (_b == null) return
        if (!LocationReporter.running) {
            b.roadStrip.visibility = View.GONE
            return
        }
        b.roadStrip.visibility = View.VISIBLE
        if (LocationReporter.lastRoadName == null) {
            b.roadName.setText(R.string.home_sensing_on)
            b.roadSub.text = ""
        } else {
            showRoad(LocationReporter.lastRoadName, LocationReporter.lastRoadStatus)
        }
    }

    private fun showRoad(name: String?, status: String?) {
        if (_b == null || name == null) return

        b.roadStrip.visibility = View.VISIBLE
        b.roadName.text = getString(R.string.home_on_road, name)

        val warn = status == "BLOCKED" || status == "RESTRICTED" || status == "SLOW"
        b.roadSub.text = if (warn) {
            getString(R.string.home_road_warning, name, status!!.lowercase())
        } else {
            getString(R.string.home_sensing_on)
        }

        b.roadDot.backgroundTintList = ColorStateList.valueOf(
            requireContext().getColor(
                when (status) {
                    "BLOCKED" -> com.sukobin.core.R.color.status_blocked
                    "RESTRICTED" -> com.sukobin.core.R.color.status_restricted
                    "SLOW" -> com.sukobin.core.R.color.status_slow
                    "OPEN" -> com.sukobin.core.R.color.status_open
                    else -> com.sukobin.core.R.color.status_unknown
                }
            )
        )
    }

    private fun renderOnlineState() {
        b.onlineTitle.setText(if (online) R.string.home_online else R.string.home_offline)
        b.onlineSub.setText(if (online) R.string.home_online_sub else R.string.home_offline_sub)
        b.onlineIcon.imageTintList = ColorStateList.valueOf(
            requireContext().getColor(
                if (online) com.sukobin.core.R.color.accent_green
                else com.sukobin.core.R.color.gray_400
            )
        )
    }

    private fun setOnline(value: Boolean) {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val r = apiCall { partnerSetOnline(jsonOf("isOnline" to value)) }) {
                is ApiResult.Ok -> {
                    online = value
                    renderOnlineState()
                    // A driver who is not working is not tracked.
                    if (value) startSensing() else LocationReporter.stop()
                    renderSensingState()
                    if (!value) clearJobs()
                }

                is ApiResult.Err -> {
                    b.onlineSwitch.isChecked = !value
                    toast(r.message)
                }
            }
        }
    }

    private fun wireAutocomplete(view: AutoCompleteTextView, onPick: (Town?) -> Unit) {
        val towns = mutableListOf<Town>()
        val listAdapter = ArrayAdapter<String>(requireContext(), android.R.layout.simple_dropdown_item_1line)
        view.setAdapter(listAdapter)

        view.setOnItemClickListener { _, _, position, _ ->
            towns.getOrNull(position)?.let {
                onPick(it)
                view.setText(it.label)
                view.dismissDropDown()
            }
        }

        view.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val q = s?.toString()?.trim().orEmpty()
                onPick(null)
                if (q.length < 2) return

                suggestJob?.cancel()
                suggestJob = viewLifecycleOwner.lifecycleScope.launch {
                    delay(220)
                    when (val r = apiCall { partnerPlaces(q) }) {
                        is ApiResult.Ok -> {
                            val places = r.value.arr("places") ?: return@launch
                            towns.clear()
                            for (el in places) {
                                val o = el as? JsonObject ?: continue
                                val coords = o.getAsJsonArray("coordinates") ?: continue
                                val label = o.get("label")?.asString ?: continue
                                towns.add(Town(label, coords[0].asDouble, coords[1].asDouble))
                            }
                            listAdapter.clear()
                            listAdapter.addAll(towns.map { it.label })
                            listAdapter.notifyDataSetChanged()
                            if (towns.isNotEmpty() && view.hasFocus()) view.showDropDown()
                        }

                        is ApiResult.Err -> Unit
                    }
                }
            }
        })
    }

    private fun findJobs() {
        if (busy) return

        if (!online) {
            toast(getString(R.string.home_offline_sub))
            return
        }

        val origin = fromTown
        val destination = toTown
        if (origin == null || destination == null) {
            toast(getString(R.string.route_error_pick))
            return
        }

        setFindBusy(true)
        selected.clear()

        viewLifecycleOwner.lifecycleScope.launch {
            val result = apiCall {
                partnerMatchRoute(
                    jsonOf(
                        "origin" to jsonOf(
                            "label" to origin.label,
                            "coordinates" to jsonArrayOf(origin.lng, origin.lat)
                        ),
                        "destination" to jsonOf(
                            "label" to destination.label,
                            "coordinates" to jsonArrayOf(destination.lng, destination.lat)
                        )
                    )
                )
            }

            setFindBusy(false)

            when (result) {
                is ApiResult.Ok -> renderMatch(result.value)
                is ApiResult.Err -> {
                    clearJobs()
                    toast(result.message)
                }
            }
        }
    }

    private fun renderMatch(body: JsonObject) {
        capacity = body.int("capacity", capacity).coerceAtLeast(1)

        val route = body.obj("route")
        b.routeSummary.visibility = View.VISIBLE
        b.routeStations.text =
            route?.arr("stations")?.joinToString("   >   ") { it.asString } ?: "-"

        val km = route?.num("distanceKm") ?: 0.0
        val min = route?.int("durationMin") ?: 0
        val source = route?.str("source")
        b.routeMeta.text = buildString {
            append("${km.toInt()} km")
            if (min > 0) append("   ~$min min")
            if (source == "osrm") append("   road route")
        }

        if (body.bool("blocked")) {
            val names = body.arr("blockedSegments")
                ?.mapNotNull { (it as? JsonObject)?.get("name")?.asString }
                ?.joinToString(", ")
            b.routeWarning.visibility = View.VISIBLE
            b.routeWarning.text = getString(R.string.route_blocked) +
                (if (!names.isNullOrBlank()) ": $names" else "")
            clearJobs(keepSummary = true)
            return
        }

        val degraded = route?.obj("conditions")?.arr("degraded")
            ?.mapNotNull { (it as? JsonObject)?.get("name")?.asString }

        if (!degraded.isNullOrEmpty()) {
            b.routeWarning.visibility = View.VISIBLE
            b.routeWarning.text = "Slow going on ${degraded.joinToString(", ")}"
        } else {
            b.routeWarning.visibility = View.GONE
        }

        jobs = body.decodeList<DeliveryJob>("jobs")
        adapter.submitList(jobs)

        b.jobsCount.text = if (jobs.isEmpty()) "" else "${jobs.size} found"
        b.emptyState.visibility = if (jobs.isEmpty()) View.VISIBLE else View.GONE
        updateBottomBar()
    }

    private fun clearJobs(keepSummary: Boolean = false) {
        jobs = emptyList()
        selected.clear()
        adapter.submitList(emptyList())
        b.jobsCount.text = ""
        b.emptyState.visibility = View.GONE
        if (!keepSummary) b.routeSummary.visibility = View.GONE
        updateBottomBar()
    }

    private fun toggle(job: DeliveryJob) {
        val k = key(job)
        if (selected.contains(k)) selected.remove(k)
        else if (selected.size < capacity) selected.add(k)
        adapter.notifyDataSetChanged()
        updateBottomBar()
    }

    private fun updateBottomBar() {
        if (selected.isEmpty()) {
            b.bottomBar.visibility = View.GONE
            return
        }

        b.bottomBar.visibility = View.VISIBLE
        b.selectedCount.text = getString(R.string.jobs_selected, selected.size, capacity)

        val total = jobs.filter { selected.contains(key(it)) }.sumOf { it.fee }
        b.selectedEarnings.text = "₹${total.toInt()}"
    }

    private fun startTrip() {
        if (busy || selected.isEmpty()) return

        val picked = jobs.filter { selected.contains(key(it)) }
        setTripBusy(true)

        viewLifecycleOwner.lifecycleScope.launch {
            val payload = JsonArray()
            for (j in picked) payload.add(jsonOf("kind" to j.kind, "id" to j.refId))

            val result = apiCall { partnerClaim(jsonOf("jobs" to payload)) }
            setTripBusy(false)

            when (result) {
                is ApiResult.Ok -> {
                    val claimed = result.value.arr("claimed")?.size() ?: picked.size
                    toast(getString(R.string.home_trip_started, claimed))
                    selected.clear()
                    // Claiming used to leave the driver on the search screen
                    // with no way to work the trip. Take them to it.
                    startActivity(Intent(requireContext(), TripActivity::class.java))
                }

                is ApiResult.Err -> toast(result.message)
            }
        }
    }

    private fun setFindBusy(value: Boolean) {
        busy = value
        b.findSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.findLabel.setText(if (value) R.string.route_searching else R.string.route_find)
        b.btnFind.isClickable = !value
    }

    private fun setTripBusy(value: Boolean) {
        busy = value
        b.tripSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnStartTrip.isClickable = !value
    }

    private fun toast(msg: String) = Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
