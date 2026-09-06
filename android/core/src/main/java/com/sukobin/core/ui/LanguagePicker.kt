package com.sukobin.core.ui

import android.content.Context
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import com.sukobin.core.net.Session

/**
 * One language list for all four apps.
 *
 * Every app now ships all nine, so this is the only place the list lives. The
 * choice drives two separate things: the app's own locale, which Android
 * resolves against res/values-XX, and Session.language, which the API reads to
 * decide what language alerts and spoken reports come back in.
 */
object LanguagePicker {

    data class Language(val code: String, val native: String, val english: String)

    val LANGUAGES = listOf(
        Language("en", "English", "English"),
        Language("hi", "हिन्दी", "Hindi"),
        Language("as", "অসমীয়া", "Assamese"),
        Language("bn", "বাংলা", "Bengali"),
        Language("ne", "नेपाली", "Nepali"),
        Language("mni", "ꯃꯤꯇꯩꯂꯣꯟ", "Meiteilon"),
        Language("kha", "Khasi", "Khasi"),
        Language("lus", "Mizo ṭawng", "Mizo"),
        Language("nag", "Nagamese", "Nagamese"),
        Language("kok", "Kokborok", "Kokborok")
    )

    fun nameOf(code: String): String =
        LANGUAGES.firstOrNull { it.code == code }?.native ?: "English"

    /**
     * Applies the choice to the running app. Android matches a BCP-47 tag
     * against the resource folder, so the three-letter codes resolve to the
     * b+xxx folders without any mapping here.
     */
    fun apply(code: String) {
        Session.language = code
        AppCompatDelegate.setApplicationLocales(
            if (code == "en") LocaleListCompat.forLanguageTags("en")
            else LocaleListCompat.forLanguageTags(code)
        )
    }

    /**
     * Shows the list and applies the choice. The activity recreates itself, so
     * onChosen runs before that: use it to tell the server, not to update UI.
     */
    fun show(context: Context, current: String = Session.language, onChosen: ((String) -> Unit)? = null) {
        val labels = LANGUAGES.map {
            if (it.native == it.english) it.native else "${it.native}  ·  ${it.english}"
        }.toTypedArray()

        val index = LANGUAGES.indexOfFirst { it.code == current }.coerceAtLeast(0)

        AlertDialog.Builder(context)
            .setTitle(com.sukobin.core.R.string.language_title)
            .setSingleChoiceItems(labels, index) { dialog, which ->
                val chosen = LANGUAGES[which].code
                dialog.dismiss()
                onChosen?.invoke(chosen)
                apply(chosen)
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    /** Call from Application.onCreate so the saved choice survives a restart. */
    fun restore() {
        val saved = Session.language
        if (saved.isNotBlank() && saved != "en") {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(saved))
        }
    }
}
