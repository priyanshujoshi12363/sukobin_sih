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
import { LangContext, LANGS, makeT, rememberLang, storedLang } from "./i18n";

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

  const [lang, setLang] = useState(storedLang);
  const t = makeT(lang);

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
        api.liveAlerts(lang),
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
  }, [lang]);

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
    <LangContext.Provider value={lang}>
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Sukobin</h1>
          <span>{t("app_tagline")}</span>
        </div>

        <div className="topbar-spacer" />

        {error && (
          <span className="pill" style={{ color: "#fca5a5", borderColor: "#5b2626" }}>
            {error}
          </span>
        )}

        <span className="pill">
          <span className={`dot ${lastSync ? "live" : ""}`} />
          {lastSync ? t("top_synced", { when: timeAgo(lastSync, t) }) : t("top_connecting")}
        </span>

        <select
          className="btn lang-select"
          value={lang}
          aria-label={t("top_language")}
          onChange={(e) => {
            setLang(e.target.value);
            rememberLang(e.target.value);
          }}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>

        <button className="btn" onClick={runRefresh} disabled={refreshing}>
          {refreshing ? t("top_recomputing") : t("top_recompute")}
        </button>
      </header>

      <div className="layout">
        <aside className="rail">
          <div className="section">
            <h2>{t("section_network")}</h2>
            <StatCards overview={overview} />
          </div>

          {overview && (
            <Distribution
              title={t("section_accessibility")}
              data={overview.accessibility}
              colors={STATUS_COLOR}
            />
          )}

          {overview && (
            <Distribution
              title={t("section_risk")}
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
              {t("tab_districts")}
            </button>
            <button
              className={`tab ${leftTab === "corridors" ? "on" : ""}`}
              onClick={() => setLeftTab("corridors")}
            >
              {t("tab_corridors")}
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
              {t("map_mode_status")}
            </button>
            <button
              className={`toggle ${colorBy === "risk" ? "on" : ""}`}
              onClick={() => setColorBy("risk")}
            >
              {t("map_mode_risk")}
            </button>
            <button
              className={`toggle ${colorBy === "forecast" ? "on" : ""}`}
              onClick={() => setColorBy("forecast")}
            >
              {t("map_mode_forecast")}
            </button>
            <button
              className={`toggle ${showVehicles ? "on" : ""}`}
              onClick={() => setShowVehicles((v) => !v)}
            >
              {t("map_layer_vehicles")}
            </button>
            <button
              className={`toggle ${showIncidents ? "on" : ""}`}
              onClick={() => setShowIncidents((v) => !v)}
            >
              {t("map_layer_incidents")}
            </button>
          </div>

          <div className="legend">
            <h3>
              {colorBy === "risk"
                ? t("legend_risk")
                : colorBy === "forecast"
                ? t("legend_forecast")
                : t("legend_accessibility")}
            </h3>
            {colorBy === "forecast"
              ? [
                  [t("legend_under_15"), "#22c55e"],
                  [t("legend_15_35"), "#eab308"],
                  [t("legend_35_60"), "#f97316"],
                  [t("legend_over_60"), "#ef4444"],
                ].map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {k}
                  </div>
                ))
              : colorBy === "risk"
              ? [
                  [t("risk_low"), "#22c55e"],
                  [t("risk_moderate"), "#eab308"],
                  [t("risk_high"), "#f97316"],
                  [t("risk_severe"), "#ef4444"],
                ].map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {k}
                  </div>
                ))
              : Object.entries(STATUS_COLOR).map(([k, c]) => (
                  <div className="legend-row" key={k}>
                    <span className="legend-swatch" style={{ background: c }} />
                    {t(`status_${k.toLowerCase()}`)}
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
              {t("legend_chokepoint")}
            </div>
          </div>
        </div>

        <aside className="rail right">
          <div className="tabs">
            {[
              ["alerts", "tab_alerts"],
              ["weak points", "tab_weak_points"],
              ["forecast", "tab_forecast"],
              ["route", "tab_route"],
              ["supplies", "tab_supplies"],
              ["emergency", "tab_emergency"],
            ].map(([id, key]) => (
              <button
                key={id}
                className={`tab ${rightTab === id ? "on" : ""}`}
                onClick={() => setRightTab(id)}
              >
                {t(key)}
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
    </LangContext.Provider>
  );
}
