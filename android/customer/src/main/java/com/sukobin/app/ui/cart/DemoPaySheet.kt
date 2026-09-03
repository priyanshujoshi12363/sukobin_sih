package com.sukobin.app.ui.cart

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.sukobin.app.R
import com.sukobin.app.databinding.DialogDemoPayBinding
import com.sukobin.app.databinding.ItemPayMethodBinding
import kotlin.math.roundToInt

class MethodAdapter(
    private val methods: List<String>,
    private val onPick: (Int) -> Unit
) : RecyclerView.Adapter<MethodAdapter.VH>() {

    var selected = 0
        private set

    inner class VH(val b: ItemPayMethodBinding) : RecyclerView.ViewHolder(b.root)

    override fun getItemCount() = methods.size

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemPayMethodBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: VH, position: Int) {
        holder.b.methodName.text = methods[position]
        holder.b.methodCheck.visibility =
            if (position == selected) View.VISIBLE else View.INVISIBLE

        holder.b.methodRow.setOnClickListener {
            val previous = selected
            selected = position
            notifyItemChanged(previous)
            notifyItemChanged(position)
            onPick(position)
        }
    }
}

class DemoPaySheet : BottomSheetDialogFragment() {

    companion object {
        const val ARG_AMOUNT = "amount"
        const val ARG_METHODS = "methods"

        fun of(amount: Double, methods: List<String>) = DemoPaySheet().apply {
            arguments = Bundle().apply {
                putDouble(ARG_AMOUNT, amount)
                putStringArrayList(ARG_METHODS, ArrayList(methods))
            }
        }
    }

    var onConfirm: ((String) -> Unit)? = null

    private var _b: DialogDemoPayBinding? = null
    private val b get() = _b!!

    private lateinit var adapter: MethodAdapter
    private var methods: List<String> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _b = DialogDemoPayBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        val amount = arguments?.getDouble(ARG_AMOUNT) ?: 0.0
        methods = arguments?.getStringArrayList(ARG_METHODS)
            ?: listOf("Google Pay", "PhonePe", "Paytm", "UPI ID", "Card")

        b.demoAmount.text = "₹" + amount.roundToInt()

        adapter = MethodAdapter(methods) { }
        b.methodList.layoutManager = LinearLayoutManager(requireContext())
        b.methodList.adapter = adapter

        b.btnDemoPay.setOnClickListener {
            setBusy(true)
            b.root.postDelayed({
                if (_b == null) return@postDelayed
                onConfirm?.invoke(methods.getOrElse(adapter.selected) { "UPI" })
                dismissAllowingStateLoss()
            }, 900)
        }
    }

    private fun setBusy(value: Boolean) {
        b.demoSpinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnDemoPay.isClickable = !value
        b.demoPayLabel.setText(
            if (value) R.string.pay_verifying else R.string.demo_pay_confirm
        )
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog =
        super.onCreateDialog(savedInstanceState).apply { setCanceledOnTouchOutside(true) }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
