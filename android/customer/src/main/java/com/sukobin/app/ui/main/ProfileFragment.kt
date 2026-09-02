package com.sukobin.app.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.sukobin.app.R
import com.sukobin.app.databinding.FragmentProfileBinding
import com.sukobin.app.ui.auth.WelcomeActivity
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.UserProfile
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.jsonOf
import com.sukobin.core.push.Push
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

        b.rowOrders.setOnClickListener {
            (activity as? MainActivity)?.selectTab(R.id.tab_orders)
        }
        b.rowParcels.setOnClickListener {
            (activity as? MainActivity)?.selectTab(R.id.tab_parcel)
        }
        b.rowSignOut.setOnClickListener { confirmSignOut() }

        loadProfile()
    }

    private fun renderFromSession() {
        val name = Session.name?.takeIf { it.isNotBlank() } ?: "User"
        b.profileName.text = name
        b.avatar.text = name.first().uppercase()
        b.profilePhone.text = Session.phone?.let { "+91 $it" } ?: ""
        b.addressLine.text = Session.address?.takeIf { it.isNotBlank() }
            ?: getString(R.string.profile_no_address)
    }

    private fun loadProfile() {
        b.profileLoading.visibility = View.VISIBLE

        lifecycleScope.launch {
            val r = apiCall { userVerify(jsonOf()) }
            if (_b == null) return@launch
            b.profileLoading.visibility = View.GONE

            when (r) {
                is ApiResult.Ok -> {
                    val user = r.value.decode<UserProfile>("user")
                    if (user != null) {
                        user.name?.takeIf { it.isNotBlank() }?.let { Session.name = it }
                        user.phone?.takeIf { it.isNotBlank() }?.let { Session.phone = it }
                        user.address?.display()?.takeIf { it.isNotBlank() }
                            ?.let { Session.address = it }
                        Session.userId = user.id
                        renderFromSession()
                    }
                    b.verifiedRow.visibility = View.VISIBLE
                }

                is ApiResult.Err -> b.verifiedRow.visibility = View.GONE
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
