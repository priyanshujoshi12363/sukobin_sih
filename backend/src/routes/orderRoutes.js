import { Router } from "express";
import { protect } from "../middleware/protect.js";
import {
  checkout,
  editCheckoutDetails,
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getMyHistory,
  getOrderById,
  cancelOrder,
  settleDemoPayment } from "../controller/orderController.js";

const router = Router();

router.post("/check-out", protect, checkout);
router.post("/edit-address", protect, editCheckoutDetails);

router.post("/create", protect, createPaymentOrder);
router.post("/demo-pay", protect, settleDemoPayment);
router.post("/verify", protect, verifyPayment);

router.get("/my-orders", protect, getMyOrders);
router.get("/history", protect, getMyHistory); // before /:id so it isn't matched as an id
router.get("/:id", protect, getOrderById);
router.patch("/:id/cancel", protect, cancelOrder);

export default router;
