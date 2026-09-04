import { Router } from "express";
import {
  sendOtp,
  verifyVehicleNumber,
  registerPartner,
  loginPartner,
  getMe,
  setOnlineStatus,
  savePartnerExpoToken,
  matchRoute,
  claimJobs,
  getActiveTrip,
  markPickedUp,
  completeDelivery,
  updateLocation,
  placeSearch,
  getPartnerStats,
  getPartnerHistory,
} from "../controller/partnerController.js";
import { partnerProtect } from "../middleware/protect.js";
import { roadConditions, whereAmI } from "../controller/driverRoadController.js";
import { createIncident } from "../controller/incidentController.js";

const router = Router();

router.post("/send-otp", sendOtp);
router.post("/verify-vehicle", verifyVehicleNumber);
router.post("/register", registerPartner);
router.post("/login", loginPartner);
router.get("/me", partnerProtect, getMe);
router.patch("/online", partnerProtect, setOnlineStatus);
router.post("/notify", partnerProtect, savePartnerExpoToken);

// ── route-matching engine ──
router.get("/places", partnerProtect, placeSearch);
router.post("/route/match", partnerProtect, matchRoute);
router.post("/trip/claim", partnerProtect, claimJobs);
router.get("/trip/active", partnerProtect, getActiveTrip);
router.post("/trip/picked", partnerProtect, markPickedUp);
router.post("/trip/deliver", partnerProtect, completeDelivery);
router.patch("/location", partnerProtect, updateLocation);
router.get("/stats", partnerProtect, getPartnerStats);
router.get("/history", partnerProtect, getPartnerHistory);

// ── the driver as a sensor and as a reporter ──
// Every carrier is already on the road, so they see hazards before any officer
// does. createIncident already understands req.partner, so a driver report
// enters the same pipeline as an officer's and is capped at RESTRICTED until
// a senior officer confirms it.
router.get("/road-conditions", partnerProtect, roadConditions);
router.get("/where-am-i", partnerProtect, whereAmI);
router.post("/report", partnerProtect, createIncident);

export default router;
