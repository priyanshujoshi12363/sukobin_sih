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
router.post("/plan-route", planRouteApi);
router.post("/refresh", refresh);

export default router;
