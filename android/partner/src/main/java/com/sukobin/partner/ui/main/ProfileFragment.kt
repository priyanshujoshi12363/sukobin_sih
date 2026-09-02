package com.sukobin.partner.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Partner
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.push.Push
import com.sukobin.partner.R
import com.sukobin.partner.databinding.FragmentProfileBinding
import com.sukobin.partner.ui.auth.WelcomeActivity
import kotlinx.coroutines.launch

class ProfileFragment : Fragment() {

    private var _b: FragmentProfileBinding? = null
    private val b get() = _b!!

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

        b.rowSignOut.setOnClickListener { confirmSignOut() }

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

                    p.name?.takeIf { it.isNotBlank() }?.let { Session.name = it }
                    p.phone?.takeIf { it.isNotBlank() }?.let { Session.phone = it }
                    renderFromSession()

                    b.vehicleLine.text = listOfNotNull(
                        p.vehicleNumber,
                        p.vehicleType?.replaceFirstChar { c -> c.uppercase() },
                        getString(R.string.profile_capacity) + " " + p.capacity
                    ).joinToString("   ")

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

    private fun confirmSignOut() {
        AlertDialog.Builder(requireContext())
            .setMessage(R.string.profile_sign_out_confirm)
            .setNegativeButton(android.R.string.cancel, null)
            .setPositiveButton(R.string.profile_sign_out) { _, _ -> signOut() }
            .show()
    }

    private fun signOut() {
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
