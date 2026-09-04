package com.sukobin.merchant.ui.main

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import coil.load
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Merchant
import com.sukobin.core.net.Session
import com.sukobin.core.net.Shop
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.decode
import com.sukobin.core.net.decodeList
import com.sukobin.merchant.R
import com.sukobin.merchant.databinding.FragmentProfileBinding
import com.sukobin.merchant.ui.auth.WelcomeActivity
import com.sukobin.merchant.ui.shop.ShopActivity
import kotlinx.coroutines.launch

class ProfileFragment : Fragment(), MainActivity.Refreshable {

    private var _b: FragmentProfileBinding? = null
    private val b get() = _b!!

    private var shop: Shop? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentProfileBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val openShop = View.OnClickListener {
            startActivity(Intent(requireContext(), ShopActivity::class.java))
        }
        b.rowShop.setOnClickListener(openShop)
        b.rowShopEdit.setOnClickListener(openShop)
        b.shopEditValue.setText(R.string.profile_edit)
        b.rowSignOut.setOnClickListener { confirmSignOut() }
        refresh()
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun refresh() {
        if (_b == null) return

        lifecycleScope.launch {
            when (val r = apiCall { merchantMe() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    val m = r.value.decode<Merchant>("merchant")
                    m?.name?.let { Session.name = it }
                    b.merchantName.text = m?.name ?: "Shopkeeper"
                    b.merchantPhone.text = m?.phone?.let { "+91 $it" }.orEmpty()
                    b.merchantEmail.text = m?.email.orEmpty()
                    b.merchantEmail.visibility =
                        if (m?.email.isNullOrBlank()) View.GONE else View.VISIBLE
                    b.walletValue.text = "₹" + m?.walletBalance?.toInt()
                }
                is ApiResult.Err -> Unit
            }
        }

        lifecycleScope.launch {
            when (val r = apiCall { myShops() }) {
                is ApiResult.Ok -> {
                    if (_b == null) return@launch
                    shop = r.value.decodeList<Shop>("shops").firstOrNull()
                        ?: r.value.decode("shop")

                    if (shop == null) {
                        b.shopValue.text = getString(R.string.profile_no_shop)
                        b.shopLogo.visibility = View.GONE
                    } else {
                        b.shopValue.text = shop?.shopName.orEmpty()
                        b.shopLogo.visibility = View.VISIBLE
                        b.shopLogo.load(shop?.shopLogo) { crossfade(true) }
                        b.shopStatus.text = getString(
                            if (shop?.isOpen == true) R.string.profile_shop_open
                            else R.string.profile_shop_closed
                        )
                    }
                }
                is ApiResult.Err -> Unit
            }
        }
    }

    private fun confirmSignOut() {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.profile_sign_out)
            .setMessage(R.string.profile_sign_out_body)
            .setNegativeButton(R.string.common_cancel, null)
            .setPositiveButton(R.string.profile_sign_out) { _, _ ->
                Session.clear()
                startActivity(
                    Intent(requireContext(), WelcomeActivity::class.java)
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
