package com.sukobin.app.ui.parcel

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.chip.Chip
import com.google.gson.JsonObject
import com.sukobin.app.R
import com.sukobin.app.databinding.FragmentParcelBinding
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.jsonArrayOf
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.num
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

class ParcelFragment : Fragment() {

    companion object {
        private val TYPES = listOf("Documents", "Electronics", "Food", "Clothes", "Medicines", "Other")
    }

    private var _b: FragmentParcelBinding? = null
    private val b get() = _b!!

    private var pickup: Place? = null
    private var drop: Place? = null
    private var type = "Other"
    private var unitIsKg = true

    private var quote: Quote? = null
    private var quoteJob: Job? = null
    private var booking = false

    data class Place(val lng: Double, val lat: Double, val address: String)
    data class Quote(
        val distanceKm: Double,
        val deliveryCharge: Double,
        val platformFee: Double,
        val totalAmount: Double
    )

    private val picker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult
        val data = result.data ?: return@registerForActivityResult

        val place = Place(
            lng = data.getDoubleExtra(PickLocationActivity.EXTRA_LNG, 0.0),
            lat = data.getDoubleExtra(PickLocationActivity.EXTRA_LAT, 0.0),
            address = data.getStringExtra(PickLocationActivity.EXTRA_ADDRESS).orEmpty()
        )

        if (data.getStringExtra(PickLocationActivity.EXTRA_TARGET) == PickLocationActivity.TARGET_DROP) {
            drop = place
        } else {
            pickup = place
        }

        renderPlaces()
        requestQuote()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = FragmentParcelBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        renderTypeChips()
        renderPlaces()

        b.rowPickup.setOnClickListener { openPicker(PickLocationActivity.TARGET_PICKUP) }
        b.rowDrop.setOnClickListener { openPicker(PickLocationActivity.TARGET_DROP) }
        b.btnRequest.setOnClickListener { requestPickup() }
        b.btnMyParcels.setOnClickListener { openMyParcels() }

        b.weightUnit.check(R.id.unitKg)
        b.weightUnit.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (!isChecked) return@addOnButtonCheckedListener
            unitIsKg = checkedId == R.id.unitKg
            requestQuote()
        }

        b.inputWeight.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, c: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) = requestQuote()
        })
    }

    private fun openPicker(target: String) {
        val existing = if (target == PickLocationActivity.TARGET_DROP) drop else pickup

        val intent = Intent(requireContext(), PickLocationActivity::class.java)
            .putExtra(PickLocationActivity.EXTRA_TARGET, target)

        existing?.let {
            intent.putExtra(PickLocationActivity.EXTRA_LAT, it.lat)
            intent.putExtra(PickLocationActivity.EXTRA_LNG, it.lng)
        }

        picker.launch(intent)
    }

    private fun openMyParcels() {
        startActivity(Intent(requireContext(), MyParcelsActivity::class.java))
    }

    private fun renderTypeChips() {
        b.typeChips.removeAllViews()
        for (t in TYPES) {
            b.typeChips.addView(Chip(requireContext()).apply {
                text = t
                isCheckable = true
                isChecked = t == type
                setOnClickListener {
                    type = t
                    requestQuote()
                }
            })
        }
    }

    private fun renderPlaces() {
        pickup.let {
            b.pickupValue.text = it?.address?.takeIf { a -> a.isNotBlank() }
                ?: getString(R.string.parcel_set_on_map)
            b.pickupAction.setText(if (it == null) R.string.parcel_set else R.string.parcel_change)
        }
        drop.let {
            b.dropValue.text = it?.address?.takeIf { a -> a.isNotBlank() }
                ?: getString(R.string.parcel_set_on_map)
            b.dropAction.setText(if (it == null) R.string.parcel_set else R.string.parcel_change)
        }
    }

    private fun weightKg(): Double {
        val raw = b.inputWeight.text.toString().toDoubleOrNull() ?: 0.0
        return if (unitIsKg) raw else raw / 1000.0
    }

    private fun requestQuote() {
        val from = pickup
        val to = drop

        if (from == null || to == null) {
            quote = null
            b.quoteCard.visibility = View.GONE
            updateRequestLabel()
            return
        }

        quoteJob?.cancel()
        b.quoting.visibility = View.VISIBLE

        quoteJob = viewLifecycleOwner.lifecycleScope.launch {
            delay(350)

            val r = apiCall {
                parcelQuote(
                    jsonOf(
                        "pickup" to jsonOf("coordinates" to jsonArrayOf(from.lng, from.lat)),
                        "drop" to jsonOf("coordinates" to jsonArrayOf(to.lng, to.lat)),
                        "weightKg" to weightKg(),
                        "type" to type
                    )
                )
            }

            if (_b == null) return@launch
            b.quoting.visibility = View.GONE

            when (r) {
                is ApiResult.Ok -> renderQuote(r.value)
                is ApiResult.Err -> {
                    quote = null
                    b.quoteCard.visibility = View.GONE
                    updateRequestLabel()
                }
            }
        }
    }

    private fun renderQuote(body: JsonObject) {
        val q = body.obj("quote") ?: body

        quote = Quote(
            distanceKm = q.num("distanceKm"),
            deliveryCharge = q.num("deliveryCharge"),
            platformFee = q.num("platformFee"),
            totalAmount = q.num("totalAmount")
        )

        b.quoteDistance.text = String.format("%.1f km", quote!!.distanceKm)
        b.quoteDelivery.text = "₹" + quote!!.deliveryCharge.roundToInt()
        b.quotePlatform.text = "₹" + quote!!.platformFee.roundToInt()
        b.quoteTotal.text = "₹" + quote!!.totalAmount.roundToInt()

        if (b.quoteCard.visibility != View.VISIBLE) {
            b.quoteCard.visibility = View.VISIBLE
            b.quoteCard.alpha = 0f
            b.quoteCard.translationY = 18f
            b.quoteCard.animate().alpha(1f).translationY(0f).setDuration(320).start()
        }

        updateRequestLabel()
    }

    private fun updateRequestLabel() {
        val q = quote
        b.requestLabel.text =
            if (q == null) getString(R.string.parcel_request_pickup)
            else getString(R.string.parcel_request_pickup_amount, "₹" + q.totalAmount.roundToInt())
    }

    private fun requestPickup() {
        if (booking) return

        val from = pickup
        val to = drop
        val name = b.inputReceiverName.text.toString().trim()
        val phone = b.inputReceiverPhone.text.toString().trim()

        if (from == null) return toast(getString(R.string.parcel_need_pickup))
        if (to == null) return toast(getString(R.string.parcel_need_drop))
        if (name.isEmpty() || phone.isEmpty()) return toast(getString(R.string.parcel_need_receiver))

        setBooking(true)

        viewLifecycleOwner.lifecycleScope.launch {
            val r = apiCall {
                parcelCreate(
                    jsonOf(
                        "pickup" to jsonOf(
                            "coordinates" to jsonArrayOf(from.lng, from.lat),
                            "address" to jsonOf("fullAddress" to from.address)
                        ),
                        "drop" to jsonOf(
                            "coordinates" to jsonArrayOf(to.lng, to.lat),
                            "address" to jsonOf("fullAddress" to to.address),
                            "contactName" to name,
                            "contactPhone" to phone
                        ),
                        "weightKg" to weightKg(),
                        "type" to type,
                        "description" to b.inputDescription.text.toString().trim()
                    )
                )
            }

            setBooking(false)

            when (r) {
                is ApiResult.Ok -> {
                    val parcel = r.value.obj("parcel")
                    showCreated(
                        parcel?.str("parcelId") ?: "-",
                        parcel?.num("totalAmount") ?: quote?.totalAmount ?: 0.0
                    )
                }

                is ApiResult.Err -> toast(r.message)
            }
        }
    }

    private fun showCreated(parcelId: String, amount: Double) {
        AlertDialog.Builder(requireContext())
            .setTitle(R.string.parcel_created)
            .setMessage(
                getString(
                    R.string.parcel_created_body,
                    parcelId,
                    "₹" + amount.roundToInt()
                )
            )
            .setPositiveButton(R.string.parcel_done) { _, _ -> resetForm() }
            .show()
    }

    private fun resetForm() {
        pickup = null
        drop = null
        quote = null
        type = "Other"

        b.inputReceiverName.setText("")
        b.inputReceiverPhone.setText("")
        b.inputDescription.setText("")
        b.inputWeight.setText("1")
        b.weightUnit.check(R.id.unitKg)
        b.quoteCard.visibility = View.GONE

        renderTypeChips()
        renderPlaces()
        updateRequestLabel()
    }

    private fun setBooking(value: Boolean) {
        booking = value
        b.bookingSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnRequest.isClickable = !value
    }

    private fun toast(msg: String) =
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
