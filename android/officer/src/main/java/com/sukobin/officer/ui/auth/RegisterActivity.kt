package com.sukobin.officer.ui.auth

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.gson.JsonObject
import com.sukobin.core.net.ApiResult
import com.sukobin.core.net.Session
import com.sukobin.core.net.apiCall
import com.sukobin.core.net.arr
import com.sukobin.core.net.jsonOf
import com.sukobin.core.net.obj
import com.sukobin.core.net.str
import com.sukobin.core.net.stringList
import com.sukobin.core.push.Push
import com.sukobin.core.push.PushPermission
import com.sukobin.core.ui.Motion
import com.sukobin.officer.data.OfficerSession
import com.sukobin.officer.databinding.ActivityRegisterBinding
import com.sukobin.officer.ui.main.MainActivity
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PHONE = "phone"
    }

    private lateinit var b: ActivityRegisterBinding
    private lateinit var pushPermission: PushPermission

    private var phone = ""
    private var busy = false

    private var departments = listOf<String>()
    private var levels = listOf<String>()
    private var districts = listOf<String>()
    private var states = listOf<Pair<String, String>>()
    private var languages = listOf<Pair<String, String>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        b = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(b.root)
        Motion.applyEnter(this)

        pushPermission = PushPermission(this)

        phone = intent.getStringExtra(EXTRA_PHONE).orEmpty()
        b.phoneLine.text = "+91 $phone"
        b.btnBack.setOnClickListener { finish() }
        b.btnSubmit.setOnClickListener { submit() }

        loadDirectory()
    }

    private fun loadDirectory() {
        b.loading.visibility = View.VISIBLE

        lifecycleScope.launch {
            when (val r = apiCall { officerDirectory() }) {
                is ApiResult.Ok -> {
                    b.loading.visibility = View.GONE
                    departments = r.value.stringList("departments")
                    levels = r.value.stringList("levels")
                    districts = r.value.stringList("districts")

                    states = r.value.arr("states")?.mapNotNull {
                        val o = it as? JsonObject ?: return@mapNotNull null
                        val code = o.get("code")?.asString ?: return@mapNotNull null
                        code to (o.get("name")?.asString ?: code)
                    }.orEmpty()

                    languages = r.value.arr("languages")?.mapNotNull {
                        val o = it as? JsonObject ?: return@mapNotNull null
                        val code = o.get("code")?.asString ?: return@mapNotNull null
                        code to (o.get("name")?.asString ?: code)
                    }.orEmpty()

                    fillDropdowns()
                }

                is ApiResult.Err -> {
                    b.loading.visibility = View.GONE
                    b.errorLine.text = r.message
                    b.errorLine.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun fillDropdowns() {
        fun fill(view: android.widget.AutoCompleteTextView, items: List<String>, initial: String?) {
            view.setAdapter(
                ArrayAdapter(this, android.R.layout.simple_list_item_1, items)
            )
            if (initial != null) view.setText(initial, false)
        }

        fill(b.departmentInput, departments.map { pretty(it) }, departments.firstOrNull()?.let { pretty(it) })
        fill(b.levelInput, levels.map { pretty(it) }, pretty("DISTRICT"))
        fill(b.districtInput, districts, null)
        fill(b.stateInput, states.map { it.second }, null)
        fill(b.languageInput, languages.map { it.second }, languages.firstOrNull()?.second)

        b.levelInput.setOnItemClickListener { _, _, _, _ -> applyLevelVisibility() }
        applyLevelVisibility()
    }

    private fun applyLevelVisibility() {
        val level = rawLevel()
        b.districtGroup.visibility = if (level == "DISTRICT" || level == "BLOCK") View.VISIBLE else View.GONE
        b.stateGroup.visibility = if (level == "REGION") View.GONE else View.VISIBLE
    }

    private fun pretty(code: String): String =
        code.split("_").joinToString(" ") { w ->
            w.lowercase().replaceFirstChar { it.uppercase() }
        }

    private fun rawLevel(): String {
        val shown = b.levelInput.text.toString()
        return levels.firstOrNull { pretty(it) == shown } ?: "DISTRICT"
    }

    private fun rawDepartment(): String {
        val shown = b.departmentInput.text.toString()
        return departments.firstOrNull { pretty(it) == shown } ?: "DISTRICT_ADMIN"
    }

    private fun rawState(): String? {
        val shown = b.stateInput.text.toString()
        return states.firstOrNull { it.second == shown }?.first
    }

    private fun rawLanguage(): String {
        val shown = b.languageInput.text.toString()
        return languages.firstOrNull { it.second == shown }?.first ?: "en"
    }

    private fun submit() {
        if (busy) return

        val name = b.nameInput.text.toString().trim()
        if (name.isEmpty()) {
            b.errorLine.text = "Enter your name"
            b.errorLine.visibility = View.VISIBLE
            return
        }

        val level = rawLevel()
        val district = b.districtInput.text.toString().trim().takeIf { it.isNotEmpty() }
        val state = rawState()

        if (level != "REGION" && district == null && state == null) {
            b.errorLine.text = "Pick the district or state you cover"
            b.errorLine.visibility = View.VISIBLE
            return
        }

        setBusy(true)

        lifecycleScope.launch {
            // The registration OTP was consumed by the failed login, so ask for
            // a fresh one and use it in the same step.
            val otpRes = apiCall { officerSendOtp(jsonOf("phone" to phone)) }
            val code = (otpRes as? ApiResult.Ok)?.value?.str("devOtp")

            if (code == null) {
                setBusy(false)
                b.errorLine.text = "Could not verify this number. Go back and sign in again."
                b.errorLine.visibility = View.VISIBLE
                return@launch
            }

            val body = jsonOf(
                "name" to name,
                "phone" to phone,
                "otp" to code,
                "employeeId" to b.employeeInput.text.toString().trim(),
                "designation" to b.designationInput.text.toString().trim(),
                "department" to rawDepartment(),
                "level" to level,
                "district" to district,
                "state" to state,
                "preferredLanguage" to rawLanguage()
            )

            when (val r = apiCall { officerRegister(body) }) {
                is ApiResult.Ok -> {
                    val officer = r.value.obj("officer")
                    Session.save(
                        token = r.value.str("token"),
                        id = officer?.str("_id"),
                        name = officer?.str("name"),
                        phone = officer?.str("phone"),
                        role = "officer"
                    )
                    OfficerSession.store(officer)
                    setBusy(false)

                    pushPermission.request {
                        lifecycleScope.launch {
                            Push.register(this@RegisterActivity) { officerSavePushToken(it) }
                        }
                    }
                    startActivity(
                        Intent(this@RegisterActivity, MainActivity::class.java)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                    )
                    finish()
                }

                is ApiResult.Err -> {
                    setBusy(false)
                    b.errorLine.text = r.message
                    b.errorLine.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        b.spinner.visibility = if (value) View.VISIBLE else View.GONE
        b.btnLabel.visibility = if (value) View.GONE else View.VISIBLE
        b.btnSubmit.isClickable = !value
    }

    override fun finish() {
        super.finish()
        Motion.overrideClose(this)
    }
}
