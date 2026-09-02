import mongoose from "mongoose";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Shop from "../models/shop.model.js";
import { getRazorpay } from "../utils/razorpay.js";
import { sendPush } from "../utils/notification.js";
import { notifyPartnersOfJob } from "../utils/notifyPartners.js";
import { fetchRoutePolyline } from "../utils/routing.js";

// when an order is packed: store its road route, then ping matching online partners
async function notifyPartnersOrderReady(order) {
  try {
    const shop = await Shop.findById(order.shop).select("location");
    if (!shop?.location?.coordinates || !order.location?.coordinates) return;

    // store the real road route shop → customer (for the driver's map + ETA)
    const route = await fetchRoutePolyline([shop.location.coordinates, order.location.coordinates]);
    order.routePolyline = route.polyline;
    order.routeDistanceKm = route.distanceKm;
    order.routeDurationMin = route.durationMin;
    await order.save();

    notifyPartnersOfJob({
      kind: "order",
      refId: order.orderId,
      type: "Order",
      fee: order.deliveryFee || 0,
      pickup: shop.location.coordinates,
      drop: order.location.coordinates,
    });
  } catch (e) {
    console.error("notifyPartnersOrderReady error:", e.message);
  }
}

const ALLOWED = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
};

const STATUS_MSG = {
  ACCEPTED: { title: "Order accepted ✅", body: (o) => `Your order ${o.orderId} was accepted by the store.` },
  PREPARING: { title: "Being prepared 👨‍🍳", body: (o) => `Your order ${o.orderId} is being packed.` },
  READY_FOR_PICKUP: { title: "Ready for pickup 📦", body: (o) => `Order ${o.orderId} is packed — a partner will pick it up soon.` },
  CANCELLED: { title: "Order cancelled", body: (o) => `Order ${o.orderId} was cancelled by the store.${o.paymentStatus === "REFUNDED" ? " Refund initiated." : ""}` },
};

async function notifyCustomer(order, status) {
  try {
    const msg = STATUS_MSG[status];
    if (!msg) return;
    const user = await User.findById(order.user).select("expoPushToken");
    if (user?.expoPushToken) {
      sendPush(user.expoPushToken, {
        title: msg.title,
        body: msg.body(order),
        data: { type: "ORDER_UPDATE", orderId: order.orderId, status, screen: "orders" },
      });
    }
  } catch (e) {
    console.error("notifyCustomer error:", e.message);
  }
}

// ─── List the merchant's orders (scoped + paginated + status filter) ─────────────
export const getMerchantOrders = async (req, res) => {
  try {
    const merchantId = req.merchant._id;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { merchant: merchantId, paymentStatus: { $ne: "PENDING" } };
    if (status) {
      // allow comma-separated group e.g. "PLACED" or "PICKED,ON_THE_WAY,DELIVERED"
      const list = String(status).split(",").map((s) => s.trim()).filter(Boolean);
      filter.orderStatus = list.length > 1 ? { $in: list } : list[0];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select("orderId items totalItems subtotal deliveryFee platformFee totalAmount orderStatus paymentStatus deliveryAddress customerPhone createdAt paidAt")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: { currentPage: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)), total, hasMore: skip + orders.length < total },
      },
    });
  } catch (error) {
    console.error("getMerchantOrders error:", error);
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
};

export const getMerchantOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, merchant: req.merchant._id })
      .populate("user", "name phone")
      .lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to load order" });
  }
};

// ─── Update order status (accept / prepare / ready / cancel) ─────────────────────
export const updateMerchantOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const merchantId = req.merchant._id;

    const order = await Order.findOne({ _id: req.params.id, merchant: merchantId });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const allowedNext = ALLOWED[order.orderStatus] || [];
    if (!allowedNext.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move order from ${order.orderStatus} to ${status}`,
      });
    }

    if (status === "CANCELLED") {
      // refund if paid, restore stock
      if (order.paymentStatus === "PAID" && order.razorpayPaymentId) {
        try {
          await getRazorpay().payments.refund(order.razorpayPaymentId, {
            notes: { reason: "Cancelled by merchant" },
          });
          order.paymentStatus = "REFUNDED";
        } catch (e) {
          console.error("Merchant cancel refund failed:", e.message);
        }
      }
      for (const it of order.items) {
        await Product.updateOne({ _id: it.product }, { $inc: { stock: it.quantity } });
      }
      order.cancelledAt = new Date();
    }

    if (status === "READY_FOR_PICKUP") {
      order.readyAt = new Date();
    }

    order.orderStatus = status;
    await order.save();

    notifyCustomer(order, status);

    // the order just became pickable → push it to matching online partners
    if (status === "READY_FOR_PICKUP") notifyPartnersOrderReady(order);

    res.status(200).json({ success: true, message: `Order ${status.toLowerCase()}`, data: { order } });
  } catch (error) {
    console.error("updateMerchantOrderStatus error:", error);
    res.status(500).json({ success: false, message: "Failed to update order" });
  }
};

// ─── Merchant sales stats ────────────────────────────────────────────────────────
export const getMerchantStats = async (req, res) => {
  try {
    const merchantId = req.merchant._id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekAgo.setHours(0, 0, 0, 0);

    // revenue = goods subtotal of paid, non-cancelled orders (delivery fee goes to driver)
    const paidNonCancelled = { merchant: merchantId, paymentStatus: { $in: ["PAID"] }, orderStatus: { $ne: "CANCELLED" } };

    const [totalsAgg, todayAgg, statusAgg, weekAgg, topProducts] = await Promise.all([
      Order.aggregate([
        { $match: paidNonCancelled },
        { $group: { _id: null, revenue: { $sum: "$subtotal" }, orders: { $sum: 1 }, items: { $sum: "$totalItems" } } },
      ]),
      Order.aggregate([
        { $match: { ...paidNonCancelled, createdAt: { $gte: startOfToday } } },
        { $group: { _id: null, revenue: { $sum: "$subtotal" }, orders: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { merchant: merchantId, paymentStatus: { $ne: "PENDING" } } },
        { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: { ...paidNonCancelled, createdAt: { $gte: weekAgo } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$subtotal" } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: paidNonCancelled },
        { $unwind: "$items" },
        { $group: { _id: "$items.name", qty: { $sum: "$items.quantity" }, revenue: { $sum: "$items.totalPrice" } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const statusCounts = {};
    statusAgg.forEach((s) => { statusCounts[s._id] = s.count; });

    // 7-day trend, filling gaps with 0
    const weekMap = {};
    weekAgg.forEach((d) => { weekMap[d._id] = d.revenue; });
    const weekTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weekTrend.push({ date: key, revenue: Math.round(weekMap[key] || 0) });
    }

    res.status(200).json({
      success: true,
      data: {
        totals: {
          revenue: Math.round(totalsAgg[0]?.revenue || 0),
          orders: totalsAgg[0]?.orders || 0,
          itemsSold: totalsAgg[0]?.items || 0,
        },
        today: {
          revenue: Math.round(todayAgg[0]?.revenue || 0),
          orders: todayAgg[0]?.orders || 0,
        },
        statusCounts,
        newOrders: statusCounts.PLACED || 0,
        weekTrend,
        topProducts: topProducts.map((p) => ({ name: p._id, qty: p.qty, revenue: Math.round(p.revenue) })),
      },
    });
  } catch (error) {
    console.error("getMerchantStats error:", error);
    res.status(500).json({ success: false, message: "Failed to load stats" });
  }
};
