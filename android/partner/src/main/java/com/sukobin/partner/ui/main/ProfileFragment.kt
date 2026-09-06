package com.sukobin.partner.ui.main

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.ui.LanguagePicker
import com.sukobin.core.net.Partner
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.push.Push
import com.sukobin.partner.BuildConfig
import com.sukobin.partner.R
import com.sukobin.partner.data.LocationReporter
import com.sukobin.partner.ui.report.ReportHazardActivity
import com.sukobin.partner.databinding.FragmentProfileBinding
import com.sukobin.partner.ui.auth.WelcomeActivity
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {

    private var _b: FragmentProfileBinding? = null
    private val b get() = _b!!

    private var partner: Partner? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentProfileBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        renderFromSession()

        b.onlineSwitch.setOnCheckedChangeListener { view2, checked ->
            if (view2.isPressed) setOnline(checked)
        }

        b.rowHistory.setOnClickListener {
            (activity as? MainActivity)?.openHistory()
        }
        b.rowEarnings.setOnClickListener {
            (activity as? MainActivity)?.openTab(R.id.tab_stats)
        }
        b.rowVehicle.setOnClickListener { showVehicle() }
        b.rowSafety.setOnClickListener { showSafety() }
        b.rowHelp.setOnClickListener { showHelp() }
        b.rowAbout.setOnClickListener { showAbout() }
        b.languageValue.text = LanguagePicker.nameOf(Session.language)
        b.rowLanguage.setOnClickListener {
            // Applying the locale recreates the activity, so this is
            // the last thing that runs on this instance.
            LanguagePicker.show(requireContext())
        }

        b.rowSignOut.setOnClickListener { confirmSignOut() }

        b.historyValue.setText(R.string.profile_history_value)
        b.aboutValue.text = BuildConfig.VERSION_NAME
        b.versionLine.setText(R.string.profile_tagline)

        load()
    }

    override fun onResume() {
        super.onResume()
        load()
    }

    private fun renderFromSession() {
        val name = Session.name?.takeIf { it.isNotBlank() } ?: "Driver"
        b.profileName.text = name
        b.avatar.text = name.first().uppercase()
        b.profilePhone.text = Session.phone?.let { "+91 $it" } ?: ""
    }

    private fun load() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val r = apiCall { partnerMe() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val p = r.value.decode<Partner>("partner") ?: return@launch
                    partner = p

                    p.name?.takeIf { it.isNotBlank() }?.let { Session.name = it }
                    p.phone?.takeIf { it.isNotBlank() }?.let { Session.phone = it }
                    renderFromSession()

                    b.vehicleNumber.text = p.vehicleNumber ?: "-"
                    b.vehicleLine.text = listOfNotNull(
                        p.vehicleType?.replaceFirstChar { c -> c.uppercase() },
                        getString(R.string.profile_carries, p.capacity)
                    ).joinToString(" · ")

                    // The badge follows the server's flag, never a local guess.
                    b.verifiedPill.visibility = if (p.isVerified) View.VISIBLE else View.GONE

                    b.vehicleValue.text = p.vehicleNumber.orEmpty()
                    b.earningsValue.text = getString(R.string.profile_deliveries, p.totalDeliveries)
                    b.onlineSwitch.isChecked = p.isOnline
                }

                is ApiResult.Err -> Unit
            }
        }
    }

    private fun setOnline(value: Boolean) {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val r = apiCall { partnerSetOnline(jsonOf("isOnline" to value)) }) {
                is ApiResult.Ok -> Unit
                is ApiResult.Err -> {
                    if (_b != null) b.onlineSwitch.isChecked = !value
                    Toast.makeText(requireContext(), r.message, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showVehicle() {
        val p = partner ?: return
        val details = buildString {
            appendLine(getString(R.string.profile_v_number, p.vehicleNumber ?: "-"))
            appendLine(getString(R.string.profile_v_type, p.vehicleType ?: "-"))
            appendLine(getString(R.string.profile_v_capacity, p.capacity))
            appendLine(getString(R.string.profile_v_trips, p.totalTrips))
            appendLine(getString(R.string.profile_v_deliveries, p.totalDeliveries))
            append(getString(R.string.profile_v_rating, p.rating))
        }

        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_vehicle)
            .setMessage(details)
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    /**
     * Safety is not a placeholder in a road-access app. The two useful things a
     * driver can do from a bad stretch are warn everyone behind them and call
     * for help, so this screen is those two buttons.
     */
    private fun showSafety() {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_safety)
            .setMessage(R.string.profile_safety_body)
            .setNeutralButton(R.string.profile_call_112) { _, _ -> dial("112") }
            .setNegativeButton(R.string.common_close, null)
            .setPositiveButton(R.string.profile_report_hazard) { _, _ ->
                startActivity(Intent(requireContext(), ReportHazardActivity::class.java))
            }
            .show()
    }

    private fun showHelp() {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_help)
            .setMessage(R.string.profile_help_body)
            .setNegativeButton(R.string.common_close, null)
            .setPositiveButton(R.string.profile_call_support) { _, _ -> dial("18001800150") }
            .show()
    }

    private fun showAbout() {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_about)
            .setMessage(getString(R.string.profile_about_body, BuildConfig.VERSION_NAME))
            .setPositiveButton(android.R.string.ok, null)
            .show()
    }

    private fun dial(number: String) {
        try {
            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
        } catch (e: Exception) {
            Toast.makeText(requireContext(), getString(R.string.profile_no_dialer), Toast.LENGTH_SHORT).show()
        }
    }

    private fun confirmSignOut() {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.profile_sign_out_confirm)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.profile_sign_out) { _, _ -> signOut() }
            .show()
    }

    private fun signOut() {
        // Stop streaming first: pings sent after the token is cleared fail
        // against an account that is no longer signed in.
        LocationReporter.stop()
        Push.forget(requireContext())
        Session.clear()
        startActivity(
            Intent(requireContext(), WelcomeActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        activity?.finish()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
