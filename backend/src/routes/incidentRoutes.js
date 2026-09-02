import { Router } from "express";
import {
  createIncident,
  syncIncidents,
  listIncidents,
  verifyIncident,
  incidentStats,
} from "../controller/incidentController.js";

const router = Router();

router.get("/", listIncidents);
router.get("/stats", incidentStats);
router.post("/", createIncident);
router.post("/sync", syncIncidents);
router.patch("/:id/verify", verifyIncident);

export default router;
