package com.sukobin.core.voice

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

/**
 * Language codes used across the platform, mapped to what Android can actually
 * speak and hear.
 *
 * Android's speech services cover Hindi, Bengali, Assamese, Nepali and English
 * to varying degrees, and cover none of Meiteilon, Khasi, Mizo, Nagamese or
 * Kokborok. Pretending otherwise would give an officer a mic button that
 * silently does nothing, so every call here reports what it actually did and
 * the UI says so.
 */
object Voice {

    private const val TAG = "SukobinVoice"

    data class Support(
        val locale: Locale,
        /** The language we are really using, which may not be the one asked for. */
        val usingCode: String,
        val exact: Boolean
    )

    private val LOCALES = mapOf(
        "en" to Locale("en", "IN"),
        "hi" to Locale("hi", "IN"),
        "bn" to Locale("bn", "IN"),
        "as" to Locale("as", "IN"),
        "ne" to Locale("ne", "NP"),
        // No Android voice exists for these. Nagamese is Assamese-adjacent and
        // Hindi is the practical lingua franca on these corridors; Kokborok
        // speakers overwhelmingly also read Bengali.
        "nag" to Locale("hi", "IN"),
        "kok" to Locale("bn", "IN"),
        "mni" to Locale("en", "IN"),
        "kha" to Locale("en", "IN"),
        "lus" to Locale("en", "IN")
    )

    private val EXACT = setOf("en", "hi", "bn", "as", "ne")

    fun resolve(code: String): Support {
        val locale = LOCALES[code] ?: Locale("en", "IN")
        val exact = code in EXACT
        val using = if (exact) code else when (code) {
            "nag" -> "hi"
            "kok" -> "bn"
            else -> "en"
        }
        return Support(locale, using, exact)
    }

    // ── speech in: the officer or driver speaks the report ──────────────────

    fun sttAvailable(context: Context): Boolean {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
        return intent.resolveActivity(context.packageManager) != null
    }

    /**
     * Builds the dictation intent. Caller launches it and reads
     * RecognizerIntent.EXTRA_RESULTS from the result.
     */
    fun dictationIntent(languageCode: String, prompt: String): Intent {
        val support = resolve(languageCode)
        return Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, support.locale.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, support.locale.language)
            // Let the engine fall back rather than fail outright on a device
            // that has no pack for the chosen language.
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false)
            putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }
    }

    fun firstResult(data: Intent?): String? =
        data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    // ── speech out: the road warns the driver who cannot look at a screen ───

    private var tts: TextToSpeech? = null
    private var ready = false
    private var currentLocale: Locale? = null

    fun warmUp(context: Context, languageCode: String, onReady: ((Boolean) -> Unit)? = null) {
        val support = resolve(languageCode)

        if (tts != null && currentLocale == support.locale) {
            onReady?.invoke(ready)
            return
        }

        shutdown()

        tts = TextToSpeech(context.applicationContext) { status ->
            if (status != TextToSpeech.SUCCESS) {
                Log.w(TAG, "tts engine unavailable")
                ready = false
                onReady?.invoke(false)
                return@TextToSpeech
            }

            val result = tts?.setLanguage(support.locale)
            val usable = result != TextToSpeech.LANG_MISSING_DATA &&
                result != TextToSpeech.LANG_NOT_SUPPORTED

            if (!usable) {
                // The device has no voice for this language even though we
                // expected one. Fall back rather than stay silent.
                Log.i(TAG, "no voice for ${support.locale}, falling back to English")
                tts?.setLanguage(Locale("en", "IN"))
            }

            currentLocale = support.locale
            ready = true
            onReady?.invoke(usable)
        }
    }

    /** Returns false when nothing was spoken, so the caller can show text instead. */
    fun speak(text: String, flush: Boolean = true): Boolean {
        if (!ready || text.isBlank()) return false
        val mode = if (flush) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
        val r = tts?.speak(text, mode, null, "sukobin-" + System.nanoTime())
        return r == TextToSpeech.SUCCESS
    }

    fun stopSpeaking() {
        tts?.stop()
    }

    fun shutdown() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        ready = false
        currentLocale = null
    }

    val speaking: Boolean
        get() = tts?.isSpeaking == true
}
