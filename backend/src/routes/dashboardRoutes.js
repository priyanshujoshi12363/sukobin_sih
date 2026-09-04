import { Router } from "express";
import {
  overview,
  segmentsGeoJson,
  segmentDetail,
  districts,
  corridors,
  alerts,
  vehicles,
  consignments,
  planRouteApi,
  emergencyRoutes,
  refresh,
  meta,
} from "../controller/dashboardController.js";
import {
  bottlenecks,
  forecastPanel,
  liveAlerts,
  coverage,
} from "../controller/bottleneckController.js";
import { refreshForecasts } from "../utils/forecast.js";
import { runAlertScan } from "../utils/alertEngine.js";

const router = Router();

router.get("/overview", overview);
router.get("/segments", segmentsGeoJson);
router.get("/segments/:segmentId", segmentDetail);
router.get("/districts", districts);
router.get("/corridors", corridors);
router.get("/alerts", alerts);
router.get("/vehicles", vehicles);
router.get("/consignments", consignments);
router.get("/emergency", emergencyRoutes);
router.get("/meta", meta);
router.get("/bottlenecks", bottlenecks);
router.get("/forecast", forecastPanel);
router.get("/live-alerts", liveAlerts);
router.get("/coverage", coverage);

router.post("/forecast/refresh", async (_req, res) => {
  try {
    res.json({ success: true, data: await refreshForecasts() });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/alerts/scan", async (_req, res) => {
  try {
    res.json({ success: true, data: await runAlertScan({ deliverPush: true }) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.post("/plan-route", planRouteApi);
router.post("/refresh", refresh);

export default router;
