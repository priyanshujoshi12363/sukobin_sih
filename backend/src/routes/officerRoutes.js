import { Router } from "express";
import { officerProtect, seniorOfficer } from "../middleware/protect.js";
import {
  sendOtp,
  login,
  register,
  verifyToken,
  updateProfile,
  registerPushToken,
  home,
  segments,
  nearby,
  alerts,
  forecast,
  myReports,
  verifyQueue,
  overrideSegmentStatus,
  directory,
} from "../controller/officerController.js";
import { createIncident, syncIncidents, verifyIncident } from "../controller/incidentController.js";

const router = Router();

router.get("/directory", directory);
router.post("/otp", sendOtp);
router.post("/login", login);
router.post("/register", register);

router.use(officerProtect);

router.post("/verify", verifyToken);
router.patch("/profile", updateProfile);
router.post("/push-token", registerPushToken);

router.get("/home", home);
router.get("/segments", segments);
router.get("/nearby", nearby);
router.get("/alerts", alerts);
router.get("/forecast", forecast);
router.get("/reports", myReports);

router.post("/report", createIncident);
router.post("/report/sync", syncIncidents);

router.get("/verify-queue", seniorOfficer, verifyQueue);
router.patch("/incident/:id/verify", seniorOfficer, verifyIncident);
router.post("/segment/:segmentId/status", seniorOfficer, overrideSegmentStatus);

export default router;
