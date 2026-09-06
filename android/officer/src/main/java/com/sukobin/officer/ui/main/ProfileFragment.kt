package com.sukobin.officer.ui.main

import com.sukobin.officer.R
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.ui.LanguagePicker
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.data.ReportQueue
import com.sukobin.officer.databinding.FragmentProfileBinding
import com.sukobin.officer.ui.auth.LoginActivity
import com.sukobin.officer.ui.report.VerifyQueueActivity
import kotlinx.coroutines.launch

class ProfileFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentProfileBinding? = null
    private val b get() = _b!!

    private val pending = PendingAdapter()


    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentProfileBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        b.reportList.layoutManager = LinearLayoutManager(requireContext())
        b.reportList.adapter = pending
        b.reportList.isNestedScrollingEnabled = false

        b.rowLanguage.setOnClickListener { pickLanguage() }
        b.rowVerifyQueue.setOnClickListener {
            startActivity(Intent(requireContext(), VerifyQueueActivity::class.java))
        }
        b.btnSyncNow.setOnClickListener { syncNow() }

        // Signing out wipes the local queue, so it sits behind a confirmation.
        b.rowSignOut.setOnClickListener { confirmSignOut() }

        refresh()
    }

    override fun onResume() {
        super.onResume()
        renderLocal()
    }

    override fun refresh() {
        renderLocal()

        lifecycleScope.launch {
            when (val r = apiCall { officerVerifySession() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val officer = r.value.obj("officer")
                    OfficerSession.store(officer)
                    officer?.str("name")?.let { Session.name = it }
                    renderLocal()
                    renderStats(officer)
                }
                is ApiResult.Err -> Unit
            }
        }

        lifecycleScope.launch {
            when (val r = apiCall { officerMyReports() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val sent = r.value.arr("reports")?.mapNotNull { el ->
                        val o = el as? JsonObject ?: return@mapNotNull null
                        PendingRow(
                            clientId = o.get("clientId")?.takeIf { !it.isJsonNull }?.asString
                                ?: o.get("incidentId")?.asString ?: return@mapNotNull null,
                            type = o.get("type")?.asString ?: "OTHER",
                            severity = o.get("severity")?.asString ?: "MEDIUM",
                            description = o.get("description")?.takeIf { !it.isJsonNull }?.asString.orEmpty(),
                            segmentName = o.get("segmentId")?.takeIf { !it.isJsonNull }?.asString,
                            capturedAt = o.get("capturedAt")?.asString.orEmpty(),
                            sent = true,
                            attempts = 0,
                            lastError = statusNote(o.get("status")?.asString)
                        )
                    }.orEmpty()

                    val queued = ReportQueue.pending().map {
                        PendingRow(
                            clientId = it.clientId,
                            type = it.type,
                            severity = it.severity,
                            description = it.description,
                            segmentName = it.segmentName,
                            capturedAt = it.capturedAt,
                            sent = false,
                            attempts = it.attempts,
                            lastError = it.lastError
                        )
                    }

                    pending.submitList(queued + sent)
                    b.reportEmpty.visibility =
                        if (queued.isEmpty() && sent.isEmpty()) View.VISIBLE else View.GONE
                }

                is ApiResult.Err -> {
                    if (_b == null) return@launch
                    val queued = ReportQueue.all().map {
                        PendingRow(it.clientId, it.type, it.severity, it.description,
                            it.segmentName, it.capturedAt, it.sent, it.attempts, it.lastError)
                    }
                    pending.submitList(queued)
                    b.reportEmpty.visibility = if (queued.isEmpty()) View.VISIBLE else View.GONE
                }
            }
        }
    }

    private fun statusNote(status: String?): String? = when (status) {
        "VERIFIED" -> getString(R.string.report_confirmed)
        "REJECTED" -> getString(R.string.report_not_accepted)
        "RESOLVED" -> getString(R.string.report_cleared)
        else -> null
    }

    private fun renderLocal() {
        if (_b == null) return

        b.officerName.text = Session.name ?: getString(R.string.profile_officer)
        b.officerPhone.text = Session.phone?.let { "+91 $it" }.orEmpty()
        b.officerRole.text = listOfNotNull(
            OfficerSession.designation,
            OfficerSession.department?.replace("_", " ")?.lowercase()
                ?.replaceFirstChar { it.uppercase() }
        ).joinToString(" · ").ifBlank { getString(R.string.profile_field_officer) }

        b.scopeValue.text = OfficerSession.scopeLabel(requireContext())
        b.levelValue.text = OfficerSession.levelLabel(requireContext())
        b.languageValue.text = LanguagePicker.nameOf(OfficerSession.language)

        b.rowVerifyQueue.visibility = if (OfficerSession.canVerify) View.VISIBLE else View.GONE
        b.permissionValue.setText(
            if (OfficerSession.canVerify) R.string.profile_can_confirm
            else R.string.profile_can_report
        )

        val queued = ReportQueue.pendingCount()
        b.queueRow.visibility = if (queued > 0) View.VISIBLE else View.GONE
        b.queueValue.text = getString(R.string.queue_count_waiting, queued)
    }

    private fun renderStats(officer: JsonObject?) {
        if (_b == null) return
        val stats = officer?.obj("stats")
        b.statReported.text = (stats?.get("incidentsReported")?.asInt ?: 0).toString()
        b.statVerified.text = (stats?.get("incidentsVerified")?.asInt ?: 0).toString()
    }

    /**
     * All nine languages now have a full UI, so the picker is the shared one
     * and the old four-language special case is gone.
     */
    private fun pickLanguage() {
        LanguagePicker.show(requireContext(), OfficerSession.language) { code ->
            OfficerSession.language = code
            lifecycleScope.launch {
                apiCall { officerUpdateProfile(jsonOf("preferredLanguage" to code)) }
            }
        }
    }

    private fun syncNow() {
        lifecycleScope.launch {
            val r = ReportQueue.sync(requireContext())
            (activity as? MainActivity)?.updateQueueBadge()
            renderLocal()
            refresh()
            val message = when {
                r.attempted == 0 -> getString(R.string.queue_nothing_waiting)
                r.message != null -> r.message
                else -> getString(R.string.queue_sent_summary, r.accepted, r.duplicates)
            }
            Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
        }
    }

    private fun confirmSignOut() {
        val queued = ReportQueue.pendingCount()
        val warning = when {
            queued == 0 -> ""
            queued == 1 -> "\n\n" + getString(R.string.profile_sign_out_unsent_one, queued)
            else -> "\n\n" + getString(R.string.profile_sign_out_unsent, queued)
        }

        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_sign_out_title)
            .setMessage(getString(R.string.profile_sign_out_body) + warning)
            .setNegativeButton(R.string.profile_stay, null)
            .setPositiveButton(R.string.profile_sign_out) { _, _ ->
                Session.clear()
                OfficerSession.clear()
                startActivity(
                    Intent(requireContext(), LoginActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
                activity?.finish()
            }
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
