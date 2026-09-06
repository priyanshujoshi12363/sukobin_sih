import { Router } from "express";
import { officerProtect, seniorOfficer } from "../middleware/protect.js";
import {
  sendOtp,
  login,
  register,
  verifyToken,
  updateProfile,
  home,
  segments,
  nearby,
  alerts,
  forecast,
  myReports,
  notifications,
  markNotificationsRead,
  verifyQueue,
  overrideSegmentStatus,
  directory,
} from "../controller/officerController.js";
import { understand as aiUnderstand, submit as aiSubmit } from "../controller/voiceReportController.js";
import upload from "../middleware/multer.js";
import { createIncident, syncIncidents, verifyIncident } from "../controller/incidentController.js";

const router = Router();

router.get("/directory", directory);
router.post("/otp", sendOtp);
router.post("/login", login);
router.post("/register", register);

router.use(officerProtect);

router.post("/verify", verifyToken);
router.patch("/profile", updateProfile);

router.get("/home", home);
router.get("/segments", segments);
router.get("/nearby", nearby);
router.get("/alerts", alerts);
router.get("/forecast", forecast);
router.get("/reports", myReports);
router.get("/notifications", notifications);
router.post("/notifications/read", markNotificationsRead);

router.post("/report", createIncident);
router.post("/report/sync", syncIncidents);

// Speak it in any language, attach a photo, let the model do the rest.
router.post("/report/understand", aiUnderstand);
router.post("/report/voice", upload.fields([{ name: "photos", maxCount: 4 }]), aiSubmit);

router.get("/verify-queue", seniorOfficer, verifyQueue);
router.patch("/incident/:id/verify", seniorOfficer, verifyIncident);
router.post("/segment/:segmentId/status", seniorOfficer, overrideSegmentStatus);

export default router;
