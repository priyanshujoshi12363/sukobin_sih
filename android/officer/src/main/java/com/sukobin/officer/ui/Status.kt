package com.sukobin.officer.ui

import android.content.Context
import com.sukobin.core.R as CoreR
import com.sukobin.officer.R

/**
 * Colours, and every piece of status wording the app shows.
 *
 * The wording all takes a Context and comes from resources, so it follows the
 * officer's chosen language. Anything hardcoded here would sit in English on a
 * screen that is otherwise Assamese, which is the state this app was in.
 */
object Status {

    fun color(status: String?): Int = when (status?.uppercase()) {
        "OPEN" -> CoreR.color.status_open
        "SLOW" -> CoreR.color.status_slow
        "RESTRICTED" -> CoreR.color.status_restricted
        "BLOCKED" -> CoreR.color.status_blocked
        else -> CoreR.color.status_unknown
    }

    fun label(context: Context, status: String?): String = context.getString(
        when (status?.uppercase()) {
            "OPEN" -> R.string.status_open
            "SLOW" -> R.string.status_slow
            "RESTRICTED" -> R.string.status_restricted
            "BLOCKED" -> R.string.status_blocked
            else -> R.string.status_unknown
        }
    )

    fun riskColor(level: String?): Int = when (level?.uppercase()) {
        "SEVERE" -> CoreR.color.risk_severe
        "HIGH" -> CoreR.color.risk_high
        "MODERATE" -> CoreR.color.risk_moderate
        else -> CoreR.color.risk_low
    }

    fun riskLabel(context: Context, level: String?): String = context.getString(
        when (level?.uppercase()) {
            "SEVERE" -> R.string.risk_severe
            "HIGH" -> R.string.risk_high
            "MODERATE" -> R.string.risk_moderate
            else -> R.string.risk_low
        }
    )

    fun severityColor(severity: String?): Int = when (severity?.uppercase()) {
        "CRITICAL" -> CoreR.color.risk_severe
        "HIGH" -> CoreR.color.risk_high
        "MEDIUM" -> CoreR.color.risk_moderate
        else -> CoreR.color.status_unknown
    }

    fun alertColor(severity: String?): Int = when (severity?.uppercase()) {
        "CRITICAL" -> CoreR.color.risk_severe
        "WARNING" -> CoreR.color.risk_high
        else -> CoreR.color.brand_green
    }

    fun severityLabel(context: Context, severity: String?): String = context.getString(
        when (severity?.uppercase()) {
            "LOW" -> R.string.severity_low
            "MEDIUM" -> R.string.severity_medium
            "HIGH" -> R.string.severity_high
            "CRITICAL" -> R.string.severity_critical
            else -> R.string.severity_medium
        }
    )

    fun alertSeverityLabel(context: Context, severity: String?): String = context.getString(
        when (severity?.uppercase()) {
            "CRITICAL" -> R.string.alert_critical
            "WARNING" -> R.string.alert_warning
            else -> R.string.alert_info
        }
    )

    fun pillBackground(status: String?): Int = when (status?.uppercase()) {
        "OPEN" -> R.drawable.bg_pill_open
        "SLOW" -> R.drawable.bg_pill_slow
        "RESTRICTED" -> R.drawable.bg_pill_restricted
        "BLOCKED" -> R.drawable.bg_pill_blocked
        else -> R.drawable.bg_pill_unknown
    }

    // A probability only becomes useful once it is a sentence.
    fun forecastPhrase(context: Context, p: Double?, hours: Int): String {
        if (p == null) return context.getString(R.string.forecast_none_yet)
        val pct = Math.round(p * 100).toInt()
        return when {
            pct >= 75 -> context.getString(R.string.forecast_very_likely, pct, hours)
            pct >= 50 -> context.getString(R.string.forecast_likely, pct, hours)
            pct >= 25 -> context.getString(R.string.forecast_watch, pct)
            else -> context.getString(R.string.forecast_fine, pct)
        }
    }

    fun percent(p: Double?): String = if (p == null) "-" else "${Math.round(p * 100)}%"

    /** Codes stay in English; only what the officer reads is translated. */
    val INCIDENT_TYPE_CODES = listOf(
        "LANDSLIDE", "FLOOD", "ROAD_DAMAGE", "BRIDGE_DAMAGE", "SNOW_ICE",
        "TREE_FALL", "ACCIDENT", "BLOCKADE", "CONGESTION", "CONSTRUCTION", "OTHER"
    )

    val SEVERITY_CODES = listOf("LOW", "MEDIUM", "HIGH", "CRITICAL")

    fun typeLabel(context: Context, code: String?): String = context.getString(
        when (code?.uppercase()) {
            "LANDSLIDE" -> R.string.type_landslide
            "FLOOD" -> R.string.type_flood
            "ROAD_DAMAGE" -> R.string.type_road_damage
            "BRIDGE_DAMAGE" -> R.string.type_bridge_damage
            "SNOW_ICE" -> R.string.type_snow_ice
            "TREE_FALL" -> R.string.type_tree_fall
            "ACCIDENT" -> R.string.type_accident
            "BLOCKADE" -> R.string.type_blockade
            "CONGESTION" -> R.string.type_congestion
            "CONSTRUCTION" -> R.string.type_construction
            else -> R.string.type_other
        }
    )

    fun incidentTypeLabels(context: Context): List<String> =
        INCIDENT_TYPE_CODES.map { typeLabel(context, it) }

    fun severityLabels(context: Context): List<String> =
        SEVERITY_CODES.map { severityLabel(context, it) }
}
