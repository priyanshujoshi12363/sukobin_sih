package com.sukobin.officer.ui

import com.sukobin.core.R as CoreR
import com.sukobin.officer.R

object Status {

    fun color(status: String?): Int = when (status?.uppercase()) {
        "OPEN" -> CoreR.color.status_open
        "SLOW" -> CoreR.color.status_slow
        "RESTRICTED" -> CoreR.color.status_restricted
        "BLOCKED" -> CoreR.color.status_blocked
        else -> CoreR.color.status_unknown
    }

    fun label(status: String?): String = when (status?.uppercase()) {
        "OPEN" -> "Open"
        "SLOW" -> "Slow"
        "RESTRICTED" -> "Restricted"
        "BLOCKED" -> "Blocked"
        else -> "Not known"
    }

    fun riskColor(level: String?): Int = when (level?.uppercase()) {
        "SEVERE" -> CoreR.color.risk_severe
        "HIGH" -> CoreR.color.risk_high
        "MODERATE" -> CoreR.color.risk_moderate
        else -> CoreR.color.risk_low
    }

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

    fun pillBackground(status: String?): Int = when (status?.uppercase()) {
        "OPEN" -> R.drawable.bg_pill_open
        "SLOW" -> R.drawable.bg_pill_slow
        "RESTRICTED" -> R.drawable.bg_pill_restricted
        "BLOCKED" -> R.drawable.bg_pill_blocked
        else -> R.drawable.bg_pill_unknown
    }

    // A probability only becomes useful once it is a sentence.
    fun forecastPhrase(p: Double?, hours: Int): String {
        if (p == null) return "No forecast yet"
        val pct = Math.round(p * 100).toInt()
        return when {
            pct >= 75 -> "$pct% chance of closing within ${hours}h"
            pct >= 50 -> "$pct% risk in the next ${hours}h"
            pct >= 25 -> "$pct% risk, worth watching"
            else -> "$pct% risk, looks fine"
        }
    }

    fun percent(p: Double?): String = if (p == null) "-" else "${Math.round(p * 100)}%"

    val INCIDENT_TYPES = listOf(
        "LANDSLIDE" to "Landslide",
        "FLOOD" to "Flooding",
        "ROAD_DAMAGE" to "Road damage",
        "BRIDGE_DAMAGE" to "Bridge damage",
        "SNOW_ICE" to "Snow or ice",
        "TREE_FALL" to "Fallen tree",
        "ACCIDENT" to "Accident",
        "BLOCKADE" to "Blockade",
        "CONGESTION" to "Heavy traffic",
        "CONSTRUCTION" to "Roadworks",
        "OTHER" to "Something else"
    )

    val SEVERITIES = listOf(
        "LOW" to "Minor",
        "MEDIUM" to "Moderate",
        "HIGH" to "Serious",
        "CRITICAL" to "Road impassable"
    )

    fun typeLabel(code: String?): String =
        INCIDENT_TYPES.firstOrNull { it.first == code }?.second ?: (code ?: "Report")
}
