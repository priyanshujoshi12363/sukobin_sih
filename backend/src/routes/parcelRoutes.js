import { Router } from "express";
import { protect } from "../middleware/protect.js";
import {
  quoteParcel,
  createParcel,
  getMyParcels,
  getParcelById,
  cancelParcel,
} from "../controller/parcelController.js";

const router = Router();

router.post("/quote", protect, quoteParcel);
router.post("/create", protect, createParcel);
router.get("/my-parcels", protect, getMyParcels);
router.get("/:id", protect, getParcelById);
router.patch("/:id/cancel", protect, cancelParcel);

export default router;
