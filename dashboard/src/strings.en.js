/**
 * Every word the dashboard shows, in English, in one place.
 *
 * Keys are stable; the English here is the source text the translator works
 * from. `%s`, `%1$s` style placeholders are not used - values are passed as
 * {name} and substituted by t(), because a translator reorders a sentence far
 * more readily when the holes are named.
 *
 * Run `node tools/translateUi.mjs` after adding anything here.
 */
export const EN = {
  // ── shell ──
  app_tagline: "NER Logistics Accessibility Intelligence",
  top_connecting: "connecting",
  top_synced: "synced {when}",
  top_recompute: "Recompute risk",
  top_recomputing: "Recomputing...",
  top_language: "Language",

  // ── left rail ──
  section_network: "Network status",
  stat_segments: "road segments",
  stat_km: "km monitored",
  stat_districts: "districts",
  stat_chokepoints: "chokepoints",
  stat_blocked_now: "blocked now",
  stat_open_incidents: "open incidents",
  stat_vehicles_online: "vehicles online",
  stat_consignments: "consignments moving",

  section_accessibility: "Accessibility",
  section_risk: "Disruption risk (predicted)",
  section_coverage: "What we can see",
  coverage_status_known: "status known",
  coverage_vehicle_data: "live vehicle data",
  coverage_forecast: "3-day forecast",
  coverage_note:
    "A road shows as not known until a vehicle passes it or an officer reports on it. The three-day forecast covers every road regardless.",

  tab_districts: "Districts",
  tab_corridors: "Corridors",

  // ── map ──
  map_mode_status: "Status",
  map_mode_risk: "Risk now",
  map_mode_forecast: "3-day forecast",
  map_layer_vehicles: "Vehicles",
  map_layer_incidents: "Incidents",

  legend_accessibility: "Accessibility",
  legend_risk: "Risk right now",
  legend_forecast: "Chance of closing in 3 days",
  legend_chokepoint: "chokepoint",
  legend_under_15: "under 15%",
  legend_15_35: "15-35%",
  legend_35_60: "35-60%",
  legend_over_60: "over 60%",

  // ── shared vocabulary ──
  status_open: "open",
  status_slow: "slow",
  status_restricted: "restricted",
  status_blocked: "blocked",
  status_unknown: "unknown",

  risk_low: "Low",
  risk_moderate: "Moderate",
  risk_high: "High",
  risk_severe: "Severe",

  // ── right rail tabs ──
  tab_alerts: "Alerts",
  tab_weak_points: "Weak points",
  tab_forecast: "Forecast",
  tab_route: "Route",
  tab_supplies: "Supplies",
  tab_emergency: "Emergency",

  // ── alerts ──
  alerts_empty: "No active alerts.",

  // ── districts ──
  districts_empty: "No district data.",
  districts_sort_az: "A-Z",
  col_district: "District",
  col_connectivity: "Connectivity",
  col_risk: "Risk",

  // ── corridors ──
  corridors_empty: "No corridors.",

  // ── supplies ──
  supplies_empty: "Nothing in transit.",
  col_ref: "Ref",
  col_commodity: "Commodity",
  col_route: "Route",

  // ── route planner ──
  route_from_placeholder: "From (e.g. Guwahati)",
  route_to_placeholder: "To (e.g. Imphal)",
  route_plan: "Plan route",
  route_planning: "Planning...",
  route_none: "No passable route",
  route_distance: "Distance",
  route_normal_time: "Normal time",
  route_with_conditions: "With conditions",
  route_delay: "Delay",
  route_worst_status: "Worst status",

  // ── emergency ──
  emergency_loading: "Loading...",
  emergency_isolated_title: "Regions at risk of isolation",
  emergency_none: "No region is currently cut off.",
  emergency_lifeline_title: "Lifeline corridor status",

  // ── weak points ──
  weak_loading: "Loading weak points...",
  weak_empty: "No weak points scored.",
  weak_blocked_now: "{n} blocked now",
  weak_at_risk_soon: "{n} likely within 3 days",
  weak_three_day: "3-day risk",
  tag_weak_point: "weak point",
  tag_lifeline: "lifeline: {regions}",

  // ── forecast ──
  forecast_loading: "Loading forecast...",
  forecast_empty: "Nothing is expected to close in the next three days.",
  forecast_how_title: "How this is predicted",
  forecast_model: "model",
  forecast_model_logreg: "logistic regression",
  forecast_model_gbt: "boosted trees",
  forecast_trained_on: "trained on",
  forecast_road_days: "{n} road-days",
  forecast_observed_weather: "observed weather",
  forecast_stretches_days: "{segments} stretches x {days} days",
  forecast_auc: "ranking accuracy (AUC)",
  forecast_brier: "average error (Brier)",
  forecast_held_out: "held out",
  forecast_held_out_value: "everything after {date}",
  forecast_weighs_title: "What it weighs",

  // ── network loading ──
  loading_network: "Loading network...",

  // ── map popups ──
  popup_length: "Length",
  popup_terrain: "Terrain",
  popup_rain_72h: "Rain 72h",
  popup_observed: "Observed",
  popup_closing_risk: "Closing risk",
  popup_district: "District",
  popup_status: "Status",
  popup_blocks_traffic: "Blocks traffic",
  popup_driver: "Driver",
  popup_type: "Type",
  popup_vehicle: "Vehicle",
  popup_online: "online",
  popup_offline: "offline",
  popup_yes: "yes",
  popup_no: "no",

  // ── time ──
  time_just_now: "just now",
  time_min_ago: "{n}m ago",
  time_hour_ago: "{n}h ago",
  time_day_ago: "{n}d ago",

  // ── added on the second sweep ──
  districts_sort_risk: "by risk",
  col_km: "km",
  col_status: "Status",
  corridor_segments: "{n} segments",
  corridor_risk: "risk {score}",
  corridor_lifeline_for: "Lifeline for {regions}",
  corridor_blocked_one: "{n} segment blocked",
  corridor_blocked_many: "{n} segments blocked",
  supplies_essential: "essential",
  route_no_delay: "none",
  unit_kmh: "{n} km/h",
  unit_km: "{n} km",
  unit_mm: "{n} mm",
  popup_risk: "Risk",
  popup_observed_vs: "{speed} km/h vs {baseline}",

  // ── alert kinds, as chips on each alert card ──
  kind_road_blocked: "road blocked",
  kind_road_restricted: "road restricted",
  kind_road_reopened: "road reopened",
  kind_forecast_risk: "forecast risk",
  kind_lifeline_cut: "lifeline cut",
  kind_incident_verified: "incident verified",
  kind_verify_request: "verify request",
};
