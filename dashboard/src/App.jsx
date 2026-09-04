import { useCallback, useEffect, useState } from "react";
import MapView from "./components/MapView";
import {
  AlertsPanel,
  BottleneckPanel,
  ConsignmentTable,
  CorridorList,
  CoverageBar,
  DistrictTable,
  Distribution,
  EmergencyPanel,
  ForecastPanel,
  RoutePlanner,
  StatCards,
} from "./components/Panels";
import { api, STATUS_COLOR, RISK_COLOR, timeAgo } from "./api";

const REFRESH_MS = 60_000;

export default function App() {
  const [overview, setOverview] = useState(null);
  const [segments, setSegments] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [consignments, setConsignments] = useState([]);
  const [incidents, setIncidents] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [bottlenecks, setBottlenecks] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [coverage, setCoverage] = useState(null);

  const [colorBy, setColorBy] = useState("status");
  const [showVehicles, setShowVehicles] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [leftTab, setLeftTab] = useState("districts");
  const [rightTab, setRightTab] = useState("alerts");

  const [plan, setPlan] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [routeLine, setRouteLine] = useState(null);

  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, s, d, c, a, v, cn, inc, em, bn, fc, cov] = await Promise.all([
        api.overview(),
        api.segments(),
        api.districts(),
        api.corridors(),
        api.liveAlerts(),
        api.vehicles(),
        api.consignments(),
        api.incidents(30),
        api.emergency(),
        api.bottlenecks(),
        api.forecast(),
        api.coverage(),
      ]);
      setOverview(o);
      setSegments(s);
      setDistricts(d.districts);
      setCorridors(c.corridors);
      setAlerts(a.alerts);
      setVehicles(v.vehicles);
      setConsignments(cn.consignments);
      setIncidents(inc.geojson);
      setEmergency(em);
      setBottlenecks(bn);
      setForecast(fc);
      setCoverage(cov);
      setLastSync(new Date().toISOString());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  async function runRefresh() {
    setRefreshing(true);
    try {
      await api.refresh();
      await api.refreshForecast();
      await api.scanAlerts();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePlan(from, to) {
    setPlanning(true);
    setPlan(null);
    setRouteLine(null);
    try {
      const result = await api.planRoute(from, to);
      setPlan(result);
      if (result.chosen?.polyline) setRouteLine(result.chosen.polyline);
    } catch (e) {
      setPlan({ found: false, rejected: [{ reason: e.message }] });
    } finally {
      setPlanning(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Sukobin</h1>
          <span>NER Logistics Accessibility Intelligence</span>
        </div>

        <div className="topbar-spacer" />

        {error && (
          <span className="pill" style={{ color: "#fca5a5", borderColor: "#5b2626" }}>
            {error}
          </span>
        )}

        <span className="pill">
          <span className={`dot ${lastSync ? "live" : ""}`} />
          {lastSync ? `synced ${timeAgo(lastSync)}` : "connecting"}
        </span>

        <button className="btn" onClick={runRefresh} disabled={refreshing}>
          {refreshing ? "Recomputing..." : "Recompute risk"}
        </button>
      </header>

      <div className="layout">
        <aside className="rail">
          <div className="section">
            <h2>Network status</h2>
            <StatCards overview={overview} />
          </div>

          {overview && (
            <Distribution
              title="Accessibility"
              data={overview.accessibility}
              colors={STATUS_COLOR}
            />
          )}

          {overview && (
            <Distribution
              title="Disruption risk (predicted)"
              data={{
                low: overview.risk.low,
                moderate: overview.risk.moderate,
                high: overview.risk.high,
                severe: overview.risk.severe,
              }}
              colors={RISK_COLOR}
            />
          )}

          <CoverageBar coverage={coverage} />

          <div className="tabs">
            <button
              className={`tab ${leftTab === "districts" ? "on" : ""}`}
              onClick={() => setLeftTab("districts")}
            >
              Districts
            </button>
            <button
              className={`tab ${leftTab === "corridors" ? "on" : ""}`}
              onClick={() => setLeftTab("corridors")}
            >
              Corridors
            </button>
          </div>

          <div className="section" style={{ borderTop: "1px solid var(--line)" }}>
            {leftTab === "districts" ? (
              <DistrictTable districts={districts} />
            ) : (
              <CorridorList corridors={corridors} />
            )}
          </div>
        </aside>

        <div className="map-wrap">
          <MapView
            segments={segments}
            vehicles={vehicles}
            incidents={incidents}
            routeLine={routeLine}
            colorBy={colorBy}
            showVehicles={showVehicles}
            showIncidents={showIncidents}
          />

          <div className="map-toggles">
            <button
              className={`toggle ${colorBy === "status" ? "on" : ""}`}
              onClick={() => setColorBy("status")}
            >
              Status
            </button>
            <button
              className={`toggle ${colorBy === "risk" ? "on" : ""}`}
              onClick={() => setColorBy("risk")}
            >
              Risk now
            </button>
            <button
              className={`toggle ${colorBy === "forecast" ? "on" : ""}`}
              onClick={() => setColorBy("forecast")}
            >
              3-day forecast
            </button>
            <button
              className={`toggle ${showVehicles ? "on" : ""}`}
              onClick={() => setShowVehicles((v) => !v)}
            >
              Vehicles
            </button>
            <button
              className={`toggle ${showIncidents ? "on" : ""}`}
              onClick={() => setShowIncidents((v) => !v)}
            >
              Incidents
            </button>
          </div>

          <div className="legend">
            <h3>
              {colorBy === "risk"
                ? "Risk right now"
                : colorBy === "forecast"
                ? "Chance of closing in 3 days"
                : "Accessibility"}
            </h3>
            {colorBy === "forecast"
              ? [
                  ["under 15%", "#22c55e"],
                  ["15-35%", "#eab308"],
                  ["35-60%", "#f97316"],
                  ["over 60%", "#ef4444"],
                ].map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {k}
                  </div>
                ))
              : colorBy === "risk"
              ? [
                  ["Low", "#22c55e"],
                  ["Moderate", "#eab308"],
                  ["High", "#f97316"],
                  ["Severe", "#ef4444"],
                ].map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {k}
                  </div>
                ))
              : Object.entries(STATUS_COLOR).map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {k.toLowerCase()}
                  </div>
                ))}
            <div className="legend-row" style={{ marginTop: 7, color: "#5f7268" }}>
              <span
                className="legend-swatch"
                style={{
                  background:
                    "repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 6px)",
                }}
              />
              chokepoint
            </div>
          </div>
        </div>

        <aside className="rail right">
          <div className="tabs">
            {["alerts", "weak points", "forecast", "route", "supplies", "emergency"].map((t) => (
              <button
                key={t}
                className={`tab ${rightTab === t ? "on" : ""}`}
                onClick={() => setRightTab(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="section" style={{ borderTop: "1px solid var(--line)" }}>
            {rightTab === "alerts" && <AlertsPanel alerts={alerts} />}
            {rightTab === "weak points" && <BottleneckPanel data={bottlenecks} />}
            {rightTab === "forecast" && <ForecastPanel data={forecast} />}
            {rightTab === "route" && (
              <RoutePlanner onPlan={handlePlan} plan={plan} planning={planning} />
            )}
            {rightTab === "supplies" && <ConsignmentTable consignments={consignments} />}
            {rightTab === "emergency" && <EmergencyPanel emergency={emergency} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
