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

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
