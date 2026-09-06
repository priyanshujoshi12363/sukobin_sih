const BASE = import.meta.env.VITE_API_BASE || "";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || `Request failed: ${path}`);
  return json.data;
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || `Request failed: ${path}`);
  return json.data;
}

export const api = {
  overview: () => get("/api/dashboard/overview"),
  segments: () => get("/api/dashboard/segments"),
  segment: (id) => get(`/api/dashboard/segments/${encodeURIComponent(id)}`),
  districts: () => get("/api/dashboard/districts"),
  corridors: () => get("/api/dashboard/corridors"),
  alerts: () => get("/api/dashboard/alerts"),
  vehicles: () => get("/api/dashboard/vehicles"),
  consignments: () => get("/api/dashboard/consignments"),
  emergency: (district) =>
    get(`/api/dashboard/emergency${district ? `?district=${encodeURIComponent(district)}` : ""}`),
  incidents: (days = 30) => get(`/api/incident?days=${days}`),
  planRoute: (from, to) => post("/api/dashboard/plan-route", { from, to }),
  refresh: () => post("/api/dashboard/refresh"),
  bottlenecks: () => get("/api/dashboard/bottlenecks"),
  forecast: () => get("/api/dashboard/forecast"),
  liveAlerts: (lang = "en") => get(`/api/dashboard/live-alerts?lang=${lang}`),
  coverage: () => get("/api/dashboard/coverage"),
  refreshForecast: () => post("/api/dashboard/forecast/refresh"),
  scanAlerts: () => post("/api/dashboard/alerts/scan"),
};

export const STATUS_COLOR = {
  OPEN: "#22c55e",
  SLOW: "#eab308",
  RESTRICTED: "#f97316",
  BLOCKED: "#ef4444",
  UNKNOWN: "#64748b",
};

export const RISK_COLOR = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  SEVERE: "#ef4444",
};

export const CONNECTIVITY_COLOR = {
  NORMAL: "#22c55e",
  DEGRADED: "#eab308",
  RESTRICTED: "#f97316",
  CUT_OFF: "#ef4444",
  UNKNOWN: "#64748b",
};

export const SEVERITY_COLOR = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#64748b",
};

export const FORECAST_COLOR = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  SEVERE: "#ef4444",
};

export function pct(v) {
  return v === null || v === undefined ? "-" : `${Math.round(v * 100)}%`;
}

// `t` is optional so a caller without a translator still gets English rather
// than a crash; every screen that shows this passes one.
export function timeAgo(iso, t) {
  if (!iso) return "";
  const say = t || ((k, v) => ({
    time_just_now: "just now",
    time_min_ago: `${v?.n}m ago`,
    time_hour_ago: `${v?.n}h ago`,
    time_day_ago: `${v?.n}d ago`,
  })[k]);

  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return say("time_just_now");
  if (s < 3600) return say("time_min_ago", { n: Math.floor(s / 60) });
  if (s < 86400) return say("time_hour_ago", { n: Math.floor(s / 3600) });
  return say("time_day_ago", { n: Math.floor(s / 86400) });
}
