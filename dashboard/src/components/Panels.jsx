import { useState } from "react";
import { useT } from "../i18n";
import {
  STATUS_COLOR,
  RISK_COLOR,
  CONNECTIVITY_COLOR,
  SEVERITY_COLOR,
  timeAgo,
  pct,
} from "../api";

export function StatCards({ overview }) {
  const t = useT();
  if (!overview) return <div className="empty">{t("loading_network")}</div>;

  const { network, logistics, accessibility, incidents } = overview;
  const cutOff = accessibility.blocked;

  return (
    <div className="stat-grid">
      <Stat v={network.segments} k={t("stat_segments")} />
      <Stat v={`${network.lengthKm.toLocaleString()}`} k={t("stat_km")} />
      <Stat v={network.districts} k={t("stat_districts")} />
      <Stat v={network.chokepoints} k={t("stat_chokepoints")} />
      <Stat v={cutOff} k={t("stat_blocked_now")} tone={cutOff > 0 ? "#ef4444" : undefined} />
      <Stat v={incidents.open} k={t("stat_open_incidents")} tone={incidents.open > 0 ? "#f97316" : undefined} />
      <Stat v={logistics.vehiclesOnline} k={t("stat_vehicles_online")} />
      <Stat v={logistics.inTransit} k={t("stat_consignments")} />
    </div>
  );
}

function Stat({ v, k, tone }) {
  return (
    <div className="stat">
      <div className="v" style={tone ? { color: tone } : undefined}>
        {v}
      </div>
      <div className="k">{k}</div>
    </div>
  );
}

export function Distribution({ title, data, colors }) {
  const t = useT();
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  // "open", "severe" and friends are bucket names from the API, not prose.
  const label = (k) => t(`${["low", "moderate", "high", "severe"].includes(k) ? "risk" : "status"}_${k}`);
  return (
    <div className="section">
      <h2>{title}</h2>
      <div className="bars">
        {Object.entries(data).map(([k, n]) => (
          <div className="bar-row" key={k}>
            <span style={{ color: colors[k.toUpperCase()] || "#93a89b" }}>{label(k)}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(n / total) * 100}%`,
                  background: colors[k.toUpperCase()] || "#64748b",
                }}
              />
            </div>
            <span className="n">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertsPanel({ alerts, onSelect }) {
  const t = useT();
  if (!alerts?.length) return <div className="empty">{t("alerts_empty")}</div>;

  return (
    <div>
      {alerts.map((a, i) => (
        <div
          className="alert"
          key={i}
          style={{ borderLeftColor: SEVERITY_COLOR[a.severity] || "#64748b" }}
          onClick={() => a.segmentId && onSelect?.(a.segmentId)}
        >
          <div className="t">{a.title}</div>
          {a.detail && <div className="d">{a.detail}</div>}
          <div className="m">
            <span className="tag">{t(`kind_${String(a.kind).toLowerCase()}`)}</span>
            <span>{a.source}</span>
            {a.districts?.length > 0 && <span>{a.districts.join(", ")}</span>}
            <span>{timeAgo(a.at, t)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DistrictTable({ districts, onSelect }) {
  const t = useT();
  const [sort, setSort] = useState("risk");

  if (!districts?.length) return <div className="empty">{t("districts_empty")}</div>;

  const sorted = [...districts].sort((a, b) =>
    sort === "risk" ? b.maxRisk - a.maxRisk : a.district.localeCompare(b.district)
  );

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          className={`toggle ${sort === "risk" ? "on" : ""}`}
          onClick={() => setSort("risk")}
        >
          {t("districts_sort_risk")}
        </button>
        <button
          className={`toggle ${sort === "name" ? "on" : ""}`}
          onClick={() => setSort("name")}
        >
          {t("districts_sort_az")}
        </button>
      </div>
      <div className="scroll-body">
        <table>
          <thead>
            <tr>
              <th>{t("col_district")}</th>
              <th>{t("col_connectivity")}</th>
              <th className="num">{t("col_risk")}</th>
              <th className="num">{t("col_km")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={`${d.state}-${d.district}`} onClick={() => onSelect?.(d)}>
                <td>
                  <div style={{ fontWeight: 600 }}>{d.district}</div>
                  <div style={{ color: "#5f7268", fontSize: 11 }}>{d.stateName}</div>
                </td>
                <td>
                  <span
                    className="status-chip"
                    style={{
                      background: `${CONNECTIVITY_COLOR[d.connectivity]}22`,
                      color: CONNECTIVITY_COLOR[d.connectivity],
                    }}
                  >
                    {d.connectivity.replace("_", " ")}
                  </span>
                </td>
                <td className="num" style={{ color: riskTone(d.maxRisk) }}>
                  {d.maxRisk.toFixed(2)}
                </td>
                <td className="num">{d.lengthKm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function riskTone(score) {
  if (score >= 0.75) return RISK_COLOR.SEVERE;
  if (score >= 0.5) return RISK_COLOR.HIGH;
  if (score >= 0.25) return RISK_COLOR.MODERATE;
  return RISK_COLOR.LOW;
}

export function CorridorList({ corridors, onSelect }) {
  const t = useT();
  if (!corridors?.length) return <div className="empty">{t("corridors_empty")}</div>;

  return (
    <div className="scroll-body">
      {corridors.map((c) => (
        <div
          className="alert"
          key={c.code}
          style={{ borderLeftColor: c.passable ? riskTone(c.maxRisk) : "#ef4444" }}
          onClick={() => onSelect?.(c)}
        >
          <div className="t">{c.highway} · {c.name.replace(/^NH-\d+\s/, "")}</div>
          <div className="m" style={{ marginTop: 5 }}>
            <span className="tag">{c.terrain}</span>
            <span>{t("unit_km", { n: c.lengthKm })}</span>
            <span>{t("corridor_segments", { n: c.segments })}</span>
            <span style={{ color: riskTone(c.maxRisk) }}>
              {t("corridor_risk", { score: c.maxRisk.toFixed(2) })}
            </span>
          </div>
          {c.lifelineFor?.length > 0 && (
            <div className="d" style={{ marginTop: 5 }}>
              {t("corridor_lifeline_for", { regions: c.lifelineFor.join(", ") })}
            </div>
          )}
          {!c.passable && (
            <div className="d" style={{ color: "#ef4444", fontWeight: 600 }}>
              {t(c.blocked === 1 ? "corridor_blocked_one" : "corridor_blocked_many", { n: c.blocked })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ConsignmentTable({ consignments }) {
  const t = useT();
  if (!consignments?.length) return <div className="empty">{t("supplies_empty")}</div>;

  return (
    <div className="scroll-body">
      <table>
        <thead>
          <tr>
            <th>{t("col_ref")}</th>
            <th>{t("col_commodity")}</th>
            <th>{t("col_route")}</th>
            <th>{t("col_status")}</th>
          </tr>
        </thead>
        <tbody>
          {consignments.map((c) => (
            <tr key={c.ref}>
              <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }}>{c.ref}</td>
              <td>
                {c.commodity}
                {c.essential && (
                  <span className="tag" style={{ marginLeft: 5, color: "#4ade80" }}>
                    {t("supplies_essential")}
                  </span>
                )}
              </td>
              <td style={{ color: "#93a89b" }}>
                {c.from} → {c.to}
              </td>
              <td>
                <span className="tag">{c.status.replace(/_/g, " ")}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoutePlanner({ onPlan, plan, planning }) {
  const t = useT();
  const [from, setFrom] = useState("Dimapur");
  const [to, setTo] = useState("Imphal");

  return (
    <div>
      <input
        className="field"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        placeholder={t("route_from_placeholder")}
      />
      <input
        className="field"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={t("route_to_placeholder")}
      />
      <button
        className="btn primary"
        style={{ width: "100%" }}
        disabled={planning}
        onClick={() => onPlan(from, to)}
      >
        {planning ? t("route_planning") : t("route_plan")}
      </button>

      {plan && (
        <div className="plan-result">
          {!plan.found ? (
            <>
              <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>
                {t("route_none")}
              </div>
              {plan.rejected?.map((r, i) => (
                <div key={i} style={{ color: "#93a89b", lineHeight: 1.45 }}>
                  {r.reason}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="kv">
                <span className="k">{t("route_distance")}</span>
                <span className="v">{plan.chosen.distanceKm} km</span>
              </div>
              <div className="kv">
                <span className="k">{t("route_normal_time")}</span>
                <span className="v">{fmtMin(plan.chosen.normalMinutes)}</span>
              </div>
              <div className="kv">
                <span className="k">{t("route_with_conditions")}</span>
                <span
                  className="v"
                  style={{ color: plan.chosen.delayMinutes > 0 ? "#f97316" : "#22c55e" }}
                >
                  {fmtMin(plan.chosen.etaMinutes)}
                </span>
              </div>
              <div className="kv">
                <span className="k">{t("route_delay")}</span>
                <span
                  className="v"
                  style={{ color: plan.chosen.delayMinutes > 0 ? "#f97316" : "#22c55e" }}
                >
                  {plan.chosen.delayMinutes > 0 ? `+${fmtMin(plan.chosen.delayMinutes)}` : t("route_no_delay")}
                </span>
              </div>
              <div className="kv">
                <span className="k">{t("route_worst_status")}</span>
                <span className="v" style={{ color: STATUS_COLOR[plan.chosen.worstStatus] }}>
                  {t(`status_${String(plan.chosen.worstStatus).toLowerCase()}`)}
                </span>
              </div>

              {plan.chosen.etaBreakdown?.length > 0 && (
                <div style={{ marginTop: 9, borderTop: "1px solid #1d2c25", paddingTop: 8 }}>
                  {plan.chosen.etaBreakdown.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "3px 0",
                        color: "#93a89b",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ flex: 1 }}>{s.name}</span>
                      <span style={{ color: STATUS_COLOR[s.status] }}>{t("unit_kmh", { n: s.speedKmph })}</span>
                      <span>{fmtMin(s.minutes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function fmtMin(m) {
  if (m == null) return "-";
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

export function EmergencyPanel({ emergency }) {
  const t = useT();
  if (!emergency) return <div className="empty">{t("emergency_loading")}</div>;

  return (
    <div>
      {emergency.isolatedRegions?.length > 0 ? (
        <div
          className="alert"
          style={{ borderLeftColor: "#ef4444", background: "#2a1618" }}
        >
          <div className="t" style={{ color: "#fca5a5" }}>
            {t("emergency_isolated_title")}
          </div>
          <div className="d">{emergency.isolatedRegions.join(", ")}</div>
        </div>
      ) : (
        <div className="empty">{t("emergency_none")}</div>
      )}

      {emergency.lifelineStatus?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h2 style={{ fontSize: 10, color: "#5f7268", letterSpacing: 0.8, margin: "0 0 8px" }}>
            {t("emergency_lifeline_title").toUpperCase()}
          </h2>
          <div className="scroll-body">
            {emergency.lifelineStatus.map((s) => (
              <div
                key={s.segmentId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "5px 0",
                  borderBottom: "1px solid #1d2c25",
                  fontSize: 12,
                }}
              >
                <span style={{ flex: 1 }}>{s.name}</span>
                <span style={{ color: STATUS_COLOR[s.status], fontWeight: 600 }}>
                  {t(`status_${String(s.status).toLowerCase()}`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Clause (g) of the problem statement asks for bottlenecks by name. Exposure is
 * scored on the server; this shows the ranking and, for each one, the reason it
 * scored, so an officer can argue with it.
 */
export function BottleneckPanel({ data, onSelect }) {
  const t = useT();
  if (!data) return <div className="empty">{t("weak_loading")}</div>;
  if (!data.bottlenecks?.length) return <div className="empty">{t("weak_empty")}</div>;

  return (
    <div className="scroll-body">
      <div className="kv" style={{ marginBottom: 10 }}>
        <span>{t("weak_blocked_now", { n: data.criticalNow })}</span>
        <span>{t("weak_at_risk_soon", { n: data.atRiskSoon })}</span>
      </div>

      {data.bottlenecks.map((b) => (
        <div className="alert" key={b.segmentId} onClick={() => onSelect?.(b.segmentId)}>
          <div className="t" style={{ display: "flex", gap: 8 }}>
            <span
              className="num"
              style={{
                color: exposureColor(b.exposure),
                minWidth: 26,
                fontWeight: 700,
              }}
            >
              {b.exposure}
            </span>
            <span style={{ flex: 1 }}>{b.name}</span>
            <span className="status-chip" style={{ color: STATUS_COLOR[b.status] }}>
              {t(`status_${String(b.status).toLowerCase()}`)}
            </span>
          </div>

          <div className="d">{b.reasons.join(" · ")}</div>

          <div className="kv" style={{ marginTop: 6 }}>
            <span>{t("unit_km", { n: Math.round(b.lengthKm) })}</span>
            <span>
              {t("weak_three_day")} {pct(b.forecast.h24)} / {pct(b.forecast.h48)} / {pct(b.forecast.h72)}
            </span>
          </div>

          {b.lifelineFor?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span className="tag">{t("tag_lifeline", { regions: b.lifelineFor.join(", ") })}</span>
            </div>
          )}
        </div>
      ))}

      <div className="empty" style={{ marginTop: 10, fontSize: 11, textAlign: "left" }}>
        {data.scoring}
      </div>
    </div>
  );
}

function exposureColor(n) {
  if (n >= 75) return "#ef4444";
  if (n >= 50) return "#f97316";
  if (n >= 25) return "#eab308";
  return "#22c55e";
}

/**
 * The trained model's three-day outlook, with the model card underneath so the
 * numbers can be judged rather than just believed.
 */
export function ForecastPanel({ data, onSelect }) {
  const t = useT();
  if (!data) return <div className="empty">{t("forecast_loading")}</div>;

  const { upcoming = [], model, importance = [] } = data;

  return (
    <div className="scroll-body">
      {upcoming.length === 0 ? (
        <div className="empty">{t("forecast_empty")}</div>
      ) : (
        upcoming.map((u) => (
          <div className="alert" key={u.segmentId} onClick={() => onSelect?.(u.segmentId)}>
            <div className="t" style={{ display: "flex", gap: 8 }}>
              <span style={{ flex: 1 }}>{u.name}</span>
              <span style={{ color: RISK_COLOR[u.level], fontWeight: 700 }}>
                {pct(u.peakProbability)}
              </span>
            </div>

            <div className="bars" style={{ marginTop: 6 }}>
              {[
                ["24h", u.h24],
                ["48h", u.h48],
                ["72h", u.h72],
              ].map(([label, v]) => (
                <div className="bar-row" key={label}>
                  <span style={{ minWidth: 26 }}>{label}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(v || 0) * 100}%`,
                        background: RISK_COLOR[u.level] || "#64748b",
                      }}
                    />
                  </div>
                  <span className="n">{pct(v)}</span>
                </div>
              ))}
            </div>

            {u.drivers?.length > 0 && (
              <div className="d" style={{ marginTop: 6 }}>
                {u.drivers.map((d) => d.factor).join(", ")}
              </div>
            )}

            {(u.isChokepoint || u.lifelineFor?.length > 0) && (
              <div style={{ marginTop: 6 }}>
                {u.isChokepoint && <span className="tag">{t("tag_weak_point")}</span>}
                {u.lifelineFor?.length > 0 && (
                  <span className="tag">{t("tag_lifeline", { regions: u.lifelineFor.join(", ") })}</span>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {model?.available && (
        <div className="section" style={{ borderTop: "1px solid var(--line)", marginTop: 12 }}>
          <h2>{t("forecast_how_title")}</h2>

          <div className="kv">
            <span>{t("forecast_model")}</span>
            <span>{t(model.chosen === "gbt" ? "forecast_model_gbt" : "forecast_model_logreg")}</span>
          </div>
          <div className="kv">
            <span>{t("forecast_trained_on")}</span>
            <span>{t("forecast_road_days", { n: (model.dataset?.rows || 0).toLocaleString() })}</span>
          </div>
          <div className="kv">
            <span>{t("forecast_observed_weather")}</span>
            <span>
              {t("forecast_stretches_days", {
                segments: model.dataset?.segments,
                days: model.dataset?.daysPerSegment,
              })}
            </span>
          </div>
          <div className="kv">
            <span>{t("forecast_auc")}</span>
            <span>{model.metrics?.auc}</span>
          </div>
          <div className="kv">
            <span>{t("forecast_brier")}</span>
            <span>{model.metrics?.brier}</span>
          </div>
          <div className="kv">
            <span>{t("forecast_held_out")}</span>
            <span>{t("forecast_held_out_value", { date: model.dataset?.splitDate })}</span>
          </div>

          <h2 style={{ marginTop: 12 }}>{t("forecast_weighs_title")}</h2>
          <div className="bars">
            {importance.map((f) => (
              <div className="bar-row" key={f.feature}>
                <span style={{ flex: "0 0 44%" }}>{f.label}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${f.weight * 100}%`, background: "#38bdf8" }}
                  />
                </div>
                <span className="n">{Math.round(f.weight * 100)}%</span>
              </div>
            ))}
          </div>

          <div className="empty" style={{ marginTop: 10, fontSize: 11, textAlign: "left" }}>
            {model.dataset?.labelNote}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A map that is mostly grey should say why rather than look broken.
 */
export function CoverageBar({ coverage }) {
  const t = useT();
  if (!coverage) return null;

  const rows = [
    [t("coverage_status_known"), coverage.percentStatusKnown, "#22c55e"],
    [t("coverage_vehicle_data"), coverage.percentWithVehicles, "#38bdf8"],
    [t("coverage_forecast"), coverage.percentWithForecast, "#a78bfa"],
  ];

  return (
    <div className="section">
      <h2>{t("section_coverage")}</h2>
      <div className="bars">
        {rows.map(([label, value, colour]) => (
          <div className="bar-row" key={label}>
            <span style={{ flex: "0 0 46%" }}>{label}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${value}%`, background: colour }} />
            </div>
            <span className="n">{value}%</span>
          </div>
        ))}
      </div>
      <div className="empty" style={{ marginTop: 8, fontSize: 11, textAlign: "left" }}>
        {t("coverage_note")}
      </div>
    </div>
  );
}
