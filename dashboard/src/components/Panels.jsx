import { useState } from "react";
import {
  STATUS_COLOR,
  RISK_COLOR,
  CONNECTIVITY_COLOR,
  SEVERITY_COLOR,
  timeAgo,
  pct,
} from "../api";

export function StatCards({ overview }) {
  if (!overview) return <div className="empty">Loading network...</div>;

  const { network, logistics, accessibility, incidents } = overview;
  const cutOff = accessibility.blocked;

  return (
    <div className="stat-grid">
      <Stat v={network.segments} k="road segments" />
      <Stat v={`${network.lengthKm.toLocaleString()}`} k="km monitored" />
      <Stat v={network.districts} k="districts" />
      <Stat v={network.chokepoints} k="chokepoints" />
      <Stat v={cutOff} k="blocked now" tone={cutOff > 0 ? "#ef4444" : undefined} />
      <Stat v={incidents.open} k="open incidents" tone={incidents.open > 0 ? "#f97316" : undefined} />
      <Stat v={logistics.vehiclesOnline} k="vehicles online" />
      <Stat v={logistics.inTransit} k="consignments moving" />
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
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="section">
      <h2>{title}</h2>
      <div className="bars">
        {Object.entries(data).map(([k, n]) => (
          <div className="bar-row" key={k}>
            <span style={{ color: colors[k.toUpperCase()] || "#93a89b" }}>{k}</span>
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
  if (!alerts?.length) return <div className="empty">No active alerts.</div>;

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
            <span className="tag">{a.kind.replace(/_/g, " ")}</span>
            <span>{a.source}</span>
            {a.districts?.length > 0 && <span>{a.districts.join(", ")}</span>}
            <span>{timeAgo(a.at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DistrictTable({ districts, onSelect }) {
  const [sort, setSort] = useState("risk");

  if (!districts?.length) return <div className="empty">No district data.</div>;

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
          by risk
        </button>
        <button
          className={`toggle ${sort === "name" ? "on" : ""}`}
          onClick={() => setSort("name")}
        >
          A-Z
        </button>
      </div>
      <div className="scroll-body">
        <table>
          <thead>
            <tr>
              <th>District</th>
              <th>Connectivity</th>
              <th className="num">Risk</th>
              <th className="num">km</th>
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
  if (!corridors?.length) return <div className="empty">No corridors.</div>;

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
            <span>{c.lengthKm} km</span>
            <span>{c.segments} segments</span>
            <span style={{ color: riskTone(c.maxRisk) }}>risk {c.maxRisk.toFixed(2)}</span>
          </div>
          {c.lifelineFor?.length > 0 && (
            <div className="d" style={{ marginTop: 5 }}>
              Lifeline for {c.lifelineFor.join(", ")}
            </div>
          )}
          {!c.passable && (
            <div className="d" style={{ color: "#ef4444", fontWeight: 600 }}>
              {c.blocked} segment{c.blocked > 1 ? "s" : ""} blocked
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ConsignmentTable({ consignments }) {
  if (!consignments?.length) return <div className="empty">Nothing in transit.</div>;

  return (
    <div className="scroll-body">
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Commodity</th>
            <th>Route</th>
            <th>Status</th>
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
                    essential
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
  const [from, setFrom] = useState("Dimapur");
  const [to, setTo] = useState("Imphal");

  return (
    <div>
      <input
        className="field"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        placeholder="From (e.g. Guwahati)"
      />
      <input
        className="field"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="To (e.g. Imphal)"
      />
      <button
        className="btn primary"
        style={{ width: "100%" }}
        disabled={planning}
        onClick={() => onPlan(from, to)}
      >
        {planning ? "Planning..." : "Plan route"}
      </button>

      {plan && (
        <div className="plan-result">
          {!plan.found ? (
            <>
              <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>
                No passable route
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
                <span className="k">Distance</span>
                <span className="v">{plan.chosen.distanceKm} km</span>
              </div>
              <div className="kv">
                <span className="k">Normal time</span>
                <span className="v">{fmtMin(plan.chosen.normalMinutes)}</span>
              </div>
              <div className="kv">
                <span className="k">With conditions</span>
                <span
                  className="v"
                  style={{ color: plan.chosen.delayMinutes > 0 ? "#f97316" : "#22c55e" }}
                >
                  {fmtMin(plan.chosen.etaMinutes)}
                </span>
              </div>
              <div className="kv">
                <span className="k">Delay</span>
                <span
                  className="v"
                  style={{ color: plan.chosen.delayMinutes > 0 ? "#f97316" : "#22c55e" }}
                >
                  {plan.chosen.delayMinutes > 0 ? `+${fmtMin(plan.chosen.delayMinutes)}` : "none"}
                </span>
              </div>
              <div className="kv">
                <span className="k">Worst status</span>
                <span className="v" style={{ color: STATUS_COLOR[plan.chosen.worstStatus] }}>
                  {plan.chosen.worstStatus}
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
                      <span style={{ color: STATUS_COLOR[s.status] }}>{s.speedKmph} km/h</span>
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
  if (!emergency) return <div className="empty">Loading...</div>;

  return (
    <div>
      {emergency.isolatedRegions?.length > 0 ? (
        <div
          className="alert"
          style={{ borderLeftColor: "#ef4444", background: "#2a1618" }}
        >
          <div className="t" style={{ color: "#fca5a5" }}>
            Regions at risk of isolation
          </div>
          <div className="d">{emergency.isolatedRegions.join(", ")}</div>
        </div>
      ) : (
        <div className="empty">No region is currently cut off.</div>
      )}

      {emergency.lifelineStatus?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h2 style={{ fontSize: 10, color: "#5f7268", letterSpacing: 0.8, margin: "0 0 8px" }}>
            LIFELINE CORRIDOR STATUS
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
                <span style={{ color: STATUS_COLOR[s.status], fontWeight: 600 }}>{s.status}</span>
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
  if (!data) return <div className="empty">Loading weak points...</div>;
  if (!data.bottlenecks?.length) return <div className="empty">No weak points scored.</div>;

  return (
    <div className="scroll-body">
      <div className="kv" style={{ marginBottom: 10 }}>
        <span>{data.criticalNow} blocked now</span>
        <span>{data.atRiskSoon} likely within 3 days</span>
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
              {b.status.toLowerCase()}
            </span>
          </div>

          <div className="d">{b.reasons.join(" · ")}</div>

          <div className="kv" style={{ marginTop: 6 }}>
            <span>{Math.round(b.lengthKm)} km</span>
            <span>
              3-day risk {pct(b.forecast.h24)} / {pct(b.forecast.h48)} / {pct(b.forecast.h72)}
            </span>
          </div>

          {b.lifelineFor?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span className="tag">lifeline: {b.lifelineFor.join(", ")}</span>
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
  if (!data) return <div className="empty">Loading forecast...</div>;

  const { upcoming = [], model, importance = [] } = data;

  return (
    <div className="scroll-body">
      {upcoming.length === 0 ? (
        <div className="empty">Nothing is expected to close in the next three days.</div>
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
                {u.isChokepoint && <span className="tag">weak point</span>}
                {u.lifelineFor?.length > 0 && (
                  <span className="tag">lifeline: {u.lifelineFor.join(", ")}</span>
                )}
              </div>
            )}
          </div>
        ))
      )}

      {model?.available && (
        <div className="section" style={{ borderTop: "1px solid var(--line)", marginTop: 12 }}>
          <h2>How this is predicted</h2>

          <div className="kv">
            <span>model</span>
            <span>{model.chosen === "gbt" ? "boosted trees" : "logistic regression"}</span>
          </div>
          <div className="kv">
            <span>trained on</span>
            <span>{(model.dataset?.rows || 0).toLocaleString()} road-days</span>
          </div>
          <div className="kv">
            <span>observed weather</span>
            <span>
              {model.dataset?.segments} stretches x {model.dataset?.daysPerSegment} days
            </span>
          </div>
          <div className="kv">
            <span>ranking accuracy (AUC)</span>
            <span>{model.metrics?.auc}</span>
          </div>
          <div className="kv">
            <span>average error (Brier)</span>
            <span>{model.metrics?.brier}</span>
          </div>
          <div className="kv">
            <span>held out</span>
            <span>everything after {model.dataset?.splitDate}</span>
          </div>

          <h2 style={{ marginTop: 12 }}>What it weighs</h2>
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
  if (!coverage) return null;

  const rows = [
    ["status known", coverage.percentStatusKnown, "#22c55e"],
    ["live vehicle data", coverage.percentWithVehicles, "#38bdf8"],
    ["3-day forecast", coverage.percentWithForecast, "#a78bfa"],
  ];

  return (
    <div className="section">
      <h2>What we can see</h2>
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
        {coverage.note}
      </div>
    </div>
  );
}
