package com.sukobin.officer.ui.main

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.int
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.net.stringList
import com.sukobin.officer.R
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.FragmentHomeBinding
import kotlinx.coroutines.launch

class HomeFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentHomeBinding? = null
    private val b get() = _b!!

    private val alerts = AlertAdapter { }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentHomeBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.alertList.layoutManager = LinearLayoutManager(requireContext())
        b.alertList.adapter = alerts
        b.alertList.isNestedScrollingEnabled = false

        b.swipe.setOnRefreshListener { refresh() }
        b.btnRetry.setOnClickListener { refresh() }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        showQueueBanner()
    }

    override fun refresh() {
        if (_b == null) return
        b.errorState.visibility = View.GONE

        lifecycleScope.launch {
            when (val r = apiCall { officerHome(OfficerSession.language) }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    b.content.visibility = View.VISIBLE
                    render(r.value)
                }

                is ApiResult.Err -> {
                    if (_b == null) return@launch
                    b.swipe.isRefreshing = false
                    if (b.content.visibility != View.VISIBLE) {
                        b.errorState.visibility = View.VISIBLE
                        b.errorText.text = r.message
                    }
                }
            }
        }
        showQueueBanner()
    }

    private fun render(data: JsonObject) {
        val officer = data.obj("officer")
        OfficerSession.store(officer)
        officer?.str("name")?.let { Session.name = it }

        b.greeting.text = "Hello, ${officer?.str("name") ?: "Officer"}"
        b.scopeLine.text = OfficerSession.scopeLabel

        val coverage = data.obj("coverage")
        b.coverageLine.text =
            "${coverage?.int("segments") ?: 0} roads  ·  ${coverage?.int("lengthKm") ?: 0} km under you"

        val byStatus = data.obj("byStatus")
        setTile(b.tileOpenValue, b.tileOpenLabel, byStatus?.int("OPEN") ?: 0, "Open", com.sukobin.core.R.color.status_open)
        setTile(b.tileSlowValue, b.tileSlowLabel, (byStatus?.int("SLOW") ?: 0) + (byStatus?.int("RESTRICTED") ?: 0), "Difficult", com.sukobin.core.R.color.status_restricted)
        setTile(b.tileBlockedValue, b.tileBlockedLabel, byStatus?.int("BLOCKED") ?: 0, "Blocked", com.sukobin.core.R.color.status_blocked)
        setTile(b.tileUnknownValue, b.tileUnknownLabel, byStatus?.int("UNKNOWN") ?: 0, "No data", com.sukobin.core.R.color.status_unknown)

        val cutOff = data.stringList("cutOff")
        if (cutOff.isEmpty()) {
            b.cutOffCard.visibility = View.GONE
        } else {
            b.cutOffCard.visibility = View.VISIBLE
            b.cutOffText.text = cutOff.joinToString(", ")
        }

        val chokepoints = data.int("chokepointsAtRisk")
        b.chokepointLine.text = if (chokepoints == 0) {
            "No weak points under threat right now"
        } else {
            "$chokepoints weak ${if (chokepoints == 1) "point is" else "points are"} blocked or likely to close"
        }

        val toVerify = data.int("awaitingMyVerification")
        b.verifyCard.visibility = if (OfficerSession.canVerify && toVerify > 0) View.VISIBLE else View.GONE
        b.verifyText.text = "$toVerify ${if (toVerify == 1) "report is" else "reports are"} waiting for you to confirm"
        b.verifyCard.setOnClickListener {
            startActivity(
                android.content.Intent(requireContext(), com.sukobin.officer.ui.report.VerifyQueueActivity::class.java)
            )
        }

        val rows = data.arr("alerts")?.mapNotNull { el ->
            val o = el as? JsonObject ?: return@mapNotNull null
            AlertRow(
                alertId = o.get("alertId")?.asString ?: return@mapNotNull null,
                severity = o.get("severity")?.asString ?: "INFO",
                title = o.get("title")?.asString.orEmpty(),
                body = o.get("body")?.asString.orEmpty(),
                segmentName = o.get("segmentName")?.takeIf { !it.isJsonNull }?.asString,
                kind = o.get("kind")?.asString.orEmpty()
            )
        }.orEmpty()

        alerts.submitList(rows)
        b.alertEmpty.visibility = if (rows.isEmpty()) View.VISIBLE else View.GONE

        val model = data.obj("model")
        if (model?.get("available")?.asBoolean == true) {
            b.modelLine.visibility = View.VISIBLE
            val auc = model.obj("metrics")?.num("auc") ?: 0.0
            b.modelLine.text = "Forecasts from a model trained on ${model.obj("dataset")?.int("rows") ?: 0} days of past weather (accuracy score ${String.format("%.2f", auc)})"
        } else {
            b.modelLine.visibility = View.GONE
        }
    }

    private fun setTile(value: android.widget.TextView, label: android.widget.TextView, n: Int, text: String, color: Int) {
        value.text = n.toString()
        value.setTextColor(ContextCompat.getColor(requireContext(), color))
        label.text = text
    }

    private fun showQueueBanner() {
        if (_b == null) return
        val pending = ReportQueue.pendingCount()
        b.queueBanner.visibility = if (pending > 0) View.VISIBLE else View.GONE
        b.queueText.text = "$pending ${if (pending == 1) "report is" else "reports are"} saved on this phone, waiting for signal"
        b.btnSyncNow.setOnClickListener {
            lifecycleScope.launch {
                val r = ReportQueue.sync()
                (activity as? MainActivity)?.updateQueueBadge()
                showQueueBanner()
                if (r.settled > 0) refresh()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
