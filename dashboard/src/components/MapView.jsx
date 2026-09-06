import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STATUS_COLOR } from "../api";
import { useT } from "../i18n";

const NER_BOUNDS = [
  [87.5, 21.8],
  [97.5, 29.5],
];

const BASE_STYLE = {
  version: 8,
  sources: {
    // CARTO now watermarks every tile with API KEY REQUIRED. Esri Dark Gray
    // Canvas is keyless and matches the dark theme; labels ride on top.
    basemap: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0d1512" } },
    { id: "basemap", type: "raster", source: "basemap", paint: { "raster-opacity": 0.85 } },
    { id: "labels", type: "raster", source: "labels", paint: { "raster-opacity": 0.6 } },
  ],
};

const statusExpression = [
  "match",
  ["get", "status"],
  "OPEN",
  STATUS_COLOR.OPEN,
  "SLOW",
  STATUS_COLOR.SLOW,
  "RESTRICTED",
  STATUS_COLOR.RESTRICTED,
  "BLOCKED",
  STATUS_COLOR.BLOCKED,
  STATUS_COLOR.UNKNOWN,
];

const riskExpression = [
  "interpolate",
  ["linear"],
  ["get", "riskScore"],
  0,
  "#22c55e",
  0.25,
  "#84cc16",
  0.5,
  "#eab308",
  0.75,
  "#f97316",
  1,
  "#ef4444",
];

// The model's three-day outlook, on the same scale the legend describes.
const forecastExpression = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "forecastPeak"], 0],
  0,
  "#22c55e",
  0.15,
  "#84cc16",
  0.35,
  "#eab308",
  0.6,
  "#f97316",
  0.85,
  "#ef4444",
];

export default function MapView({
  segments,
  vehicles,
  incidents,
  routeLine,
  colorBy,
  showVehicles,
  showIncidents,
  onSelectSegment,
}) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const container = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);

  // The map's load event waits on the basemap coming over the network, while
  // the API answers in milliseconds. Everything that arrived in that window
  // used to be dropped on the floor, leaving an empty map until the 60-second
  // poll happened to fire again. Hold it here instead and flush it on load.
  const pending = useRef(new Map());
  const colorRef = useRef(colorBy);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: container.current,
      style: BASE_STYLE,
      bounds: NER_BOUNDS,
      fitBoundsOptions: { padding: 50 },
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    map.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.current.on("load", () => {
      const m = map.current;

      m.addSource("segments", { type: "geojson", data: empty() });
      m.addSource("vehicles", { type: "geojson", data: empty() });
      m.addSource("incidents", { type: "geojson", data: empty() });
      m.addSource("route", { type: "geojson", data: empty() });

      m.addLayer({
        id: "segments-glow",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": statusExpression,
          "line-width": 11,
          "line-opacity": 0.16,
          "line-blur": 4,
        },
      });

      m.addLayer({
        id: "segments-line",
        type: "line",
        source: "segments",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": statusExpression,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2.2, 9, 4.5, 12, 7],
          "line-opacity": 0.95,
        },
      });

      m.addLayer({
        id: "chokepoints",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "isChokepoint"], true],
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 1.4,
          "line-opacity": 0.5,
          "line-dasharray": [1, 3],
        },
      });

      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 5,
          "line-opacity": 0.9,
          "line-dasharray": [2, 1.5],
        },
      });

      m.addLayer({
        id: "incidents-halo",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-radius": 13,
          "circle-color": "#ef4444",
          "circle-opacity": 0.18,
        },
      });

      m.addLayer({
        id: "incidents-dot",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-radius": 5,
          "circle-color": "#ef4444",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0d1512",
        },
      });

      m.addLayer({
        id: "vehicles-dot",
        type: "circle",
        source: "vehicles",
        paint: {
          "circle-radius": 6,
          "circle-color": ["case", ["get", "online"], "#38bdf8", "#64748b"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0d1512",
        },
      });

      ready.current = true;

      // Reachable from the console during development, for checking what the
      // map actually holds when the screen and the data disagree.
      if (import.meta.env.DEV) window.__sukobinMap = m;

      for (const [id, data] of pending.current) m.getSource(id)?.setData(data);
      pending.current.clear();

      const expr = paintFor(colorRef.current);
      m.setPaintProperty("segments-line", "line-color", expr);
      m.setPaintProperty("segments-glow", "line-color", expr);

      m.on("click", "segments-line", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        showSegmentPopup(m, e.lngLat, f.properties, tRef.current);
        onSelectSegment?.(f.properties.segmentId);
      });

      m.on("click", "incidents-dot", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const t = tRef.current;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="popup-title">${esc(p.type)} - ${esc(p.severity)}</div>
             <div class="popup-row"><span>${esc(t("popup_district"))}</span><b>${esc(p.district || "-")}</b></div>
             <div class="popup-row"><span>${esc(t("popup_status"))}</span><b>${esc(p.status)}</b></div>
             <div class="popup-row"><span>${esc(t("popup_blocks_traffic"))}</span><b>${esc(t(p.blocksTraffic === "true" || p.blocksTraffic === true ? "popup_yes" : "popup_no"))}</b></div>
             ${p.description ? `<div style="margin-top:7px;color:#93a89b;line-height:1.4">${esc(p.description).slice(0, 180)}</div>` : ""}`
          )
          .addTo(m);
      });

      m.on("click", "vehicles-dot", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const t = tRef.current;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="popup-title">${esc(p.vehicleNumber || t("popup_vehicle"))}</div>
             <div class="popup-row"><span>${esc(t("popup_driver"))}</span><b>${esc(p.name || "-")}</b></div>
             <div class="popup-row"><span>${esc(t("popup_type"))}</span><b>${esc(p.vehicleType || "-")}</b></div>
             <div class="popup-row"><span>${esc(t("popup_status"))}</span><b>${esc(t(p.online === "true" || p.online === true ? "popup_online" : "popup_offline"))}</b></div>`
          )
          .addTo(m);
      });

      for (const layer of ["segments-line", "incidents-dot", "vehicles-dot"]) {
        m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    apply("segments", segments);
  }, [segments]);

  useEffect(() => {
    apply(
      "vehicles",
      showVehicles
        ? {
            type: "FeatureCollection",
            features: (vehicles || [])
              .filter((v) => v.coordinates)
              .map((v) => ({
                type: "Feature",
                geometry: { type: "Point", coordinates: v.coordinates },
                properties: {
                  name: v.name,
                  vehicleNumber: v.vehicleNumber,
                  vehicleType: v.vehicleType,
                  online: v.online,
                },
              })),
          }
        : empty()
    );
  }, [vehicles, showVehicles]);

  useEffect(() => {
    apply("incidents", showIncidents ? incidents : empty());
  }, [incidents, showIncidents]);

  useEffect(() => {
    apply(
      "route",
      routeLine
        ? {
            type: "FeatureCollection",
            features: [
              { type: "Feature", geometry: { type: "LineString", coordinates: routeLine }, properties: {} },
            ],
          }
        : empty()
    );
    if (routeLine?.length && map.current) {
      const b = routeLine.reduce(
        (acc, c) => acc.extend(c),
        new maplibregl.LngLatBounds(routeLine[0], routeLine[0])
      );
      map.current.fitBounds(b, { padding: 90, duration: 900 });
    }
  }, [routeLine]);

  useEffect(() => {
    colorRef.current = colorBy;
    if (!ready.current || !map.current) return;
    const expr = paintFor(colorBy);
    map.current.setPaintProperty("segments-line", "line-color", expr);
    map.current.setPaintProperty("segments-glow", "line-color", expr);
  }, [colorBy]);

  function apply(id, data) {
    const payload = data || empty();
    if (!ready.current || !map.current) {
      pending.current.set(id, payload);
      return;
    }
    const src = map.current.getSource(id);
    if (src) src.setData(payload);
  }

  return <div className="map" ref={container} />;
}

function paintFor(mode) {
  if (mode === "risk") return riskExpression;
  if (mode === "forecast") return forecastExpression;
  return statusExpression;
}

function empty() {
  return { type: "FeatureCollection", features: [] };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function showSegmentPopup(m, lngLat, p, t) {
  const drivers = safeParse(p.riskDrivers);
  const top = drivers?.[0];
  const speed = p.observedSpeedKmph;

  new maplibregl.Popup({ closeButton: true, maxWidth: "320px" })
    .setLngLat(lngLat)
    .setHTML(
      `<div class="popup-title">${esc(p.name)}</div>
       <div class="popup-row"><span>${esc(t("popup_status"))}</span><b style="color:${STATUS_COLOR[p.status] || "#64748b"}">${esc(t(`status_${String(p.status).toLowerCase()}`))}</b></div>
       <div class="popup-row"><span>${esc(t("popup_risk"))}</span><b>${esc(t(`risk_${String(p.riskLevel).toLowerCase()}`))} (${Number(p.riskScore).toFixed(2)})</b></div>
       <div class="popup-row"><span>${esc(t("popup_length"))}</span><b>${esc(t("unit_km", { n: Number(p.lengthKm).toFixed(1) }))}</b></div>
       <div class="popup-row"><span>${esc(t("popup_terrain"))}</span><b>${esc(p.terrain)}</b></div>
       <div class="popup-row"><span>${esc(t("popup_rain_72h"))}</span><b>${esc(t("unit_mm", { n: Number(p.rain72hMm).toFixed(0) }))}</b></div>
       ${speed ? `<div class="popup-row"><span>${esc(t("popup_observed"))}</span><b>${esc(t("popup_observed_vs", { speed, baseline: p.baselineSpeedKmph }))}</b></div>` : ""}
       ${p.forecastH72 !== undefined && p.forecastH72 !== null && p.forecastH72 !== "null"
         ? `<div class="popup-row"><span>${esc(t("popup_closing_risk"))}</span><b>${fpc(p.forecastH24)} / ${fpc(p.forecastH48)} / ${fpc(p.forecastH72)}</b></div>`
         : ""}
       ${top ? `<div style="margin-top:7px;color:#93a89b;line-height:1.4">Top driver: ${esc(top.factor)} ${esc(top.detail || "")}</div>` : ""}
       ${p.statusNote ? `<div style="margin-top:6px;color:#93a89b;line-height:1.4">${esc(p.statusNote)}</div>` : ""}
       ${safeParse(p.lifelineFor)?.length ? `<div style="margin-top:7px"><span class="tag">lifeline: ${esc(safeParse(p.lifelineFor).join(", "))}</span></div>` : ""}`
    )
    .addTo(m);
}

function fpc(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n * 100)}%` : "-";
}

function safeParse(v) {
  if (Array.isArray(v)) return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
