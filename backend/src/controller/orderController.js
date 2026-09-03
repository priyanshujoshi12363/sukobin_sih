import crypto from "crypto";
import {
  demoPaymentEnabled,
  demoOrderPayload,
  demoReference,
  DEMO_NOTICE,
} from "../utils/demoPayment.js";
import mongoose from "mongoose";
import Cart from "../models/cart.models.js";
import Shop from "../models/shop.model.js";
import User from "../models/user.model.js";
import Merchant from "../models/merchant.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import Parcel from "../models/parcel.model.js";
import { getRazorpay } from "../utils/razorpay.js";
import { sendPush } from "../utils/notification.js";
import { sendMerchantOrderEmail } from "../utils/email.js";
import {
  calculateDeliveryFee,
  calculateDistance,
} from "../utils/calculation.js";

const PLATFORM_FEE = 2;

export const checkout = async (req, res) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId })
      .populate("shop")
      .populate("items.product");

    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const shop = await Shop.findById(cart.shop._id);
    if (!shop) {
      return res.status(404).json({ success: false, message: "Shop not found" });
    }

    const userCoordinates = user.location.coordinates;
    const shopCoordinates = shop.location.coordinates;

    const distance = calculateDistance(
      userCoordinates[1],
      userCoordinates[0],
      shopCoordinates[1],
      shopCoordinates[0]
    );
    const deliveryFee = calculateDeliveryFee(distance, cart.subtotal);
    const platformFee = PLATFORM_FEE;
    const totalAmount = cart.subtotal + deliveryFee + platformFee;

    res.status(200).json({
      success: true,
      checkout: {
        shop: { _id: shop._id, shopName: shop.shopName, shopLogo: shop.shopLogo },
        customer: {
          name: user.name,
          phone: user.phone,
          coordinates: user.location.coordinates,
        },
        deliveryAddress: user.address,
        items: cart.items,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        deliveryFee,
        platformFee,
        totalAmount,
        distance: distance.toFixed(2),
        estimatedDelivery: "soon",
        paymentMethod: "RAZORPAY",
      },
    });
  } catch (error) {
    console.log("Checkout Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const editCheckoutDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      name,
      houseNumber,
      landmark,
      village,
      town,
      district,
      state,
      pincode,
      fullAddress,
      coordinates,
      notes,
    } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name) user.name = name;

    user.address = {
      houseNumber: houseNumber || user.address?.houseNumber,
      landmark: landmark || user.address?.landmark,
      village: village || user.address?.village,
      town: town || user.address?.town,
      district: district || user.address?.district,
      state: state || user.address?.state,
      pincode: pincode || user.address?.pincode,
      fullAddress: fullAddress || user.address?.fullAddress,
    };

    if (coordinates && coordinates.length === 2) {
      user.location = { type: "Point", coordinates };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Checkout details updated successfully",
      user,
    });
  } catch (error) {
    console.log("Edit Checkout Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

async function fulfillPaidOrder(order, paymentId, signature) {
  let didFulfill = false;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const set = {
        paymentStatus: "PAID",
        orderStatus: "PLACED",
        razorpayPaymentId: paymentId,
        paidAt: new Date(),
      };
      if (signature) set.razorpaySignature = signature;

      const claimed = await Order.findOneAndUpdate(
        { _id: order._id, paymentStatus: "PENDING" },
        { $set: set },
        { new: true, session }
      );
      if (!claimed) return;

      for (const item of claimed.items) {
        const result = await Product.updateOne(
          { _id: item.product, stock: { $gte: item.quantity }, isActive: true },
          { $inc: { stock: -item.quantity } },
          { session }
        );
        if (result.matchedCount === 0) {
          throw new Error(`"${item.name}" is out of stock`);
        }
      }

      await Shop.updateOne({ _id: claimed.shop }, { $inc: { totalOrders: 1 } }, { session });
      await Merchant.updateOne({ _id: claimed.merchant }, { $inc: { totalOrders: 1 } }, { session });
      await User.updateOne({ _id: claimed.user }, { $inc: { totalOrders: 1 } }, { session });
      await Cart.deleteOne({ user: claimed.user }, { session });

      order.paymentStatus = "PAID";
      order.orderStatus = "PLACED";
      order.razorpayPaymentId = paymentId;
      order.paidAt = set.paidAt;
      didFulfill = true;
    });
  } finally {
    await session.endSession();
  }
  return didFulfill;
}

async function notifyOrderParties(order) {
  try {
    const [user, merchant] = await Promise.all([
      User.findById(order.user).select("expoPushToken name"),
      Merchant.findById(order.merchant).select("expoPushToken email name businessName"),
    ]);

    const amount = `₹${order.totalAmount.toLocaleString("en-IN")}`;

    if (user?.expoPushToken) {
      sendPush(user.expoPushToken, {
        title: "Order placed ✅",
        body: `Your order ${order.orderId} is confirmed · ${amount}`,
        data: { type: "ORDER_PLACED", orderId: order.orderId, screen: "orders" },
      });
    }

    if (merchant?.expoPushToken) {
      sendPush(merchant.expoPushToken, {
        title: "New order 🛒",
        body: `${order.items.length} item(s) · ${amount}`,
        data: { type: "NEW_ORDER", orderId: order.orderId, screen: "orders" },
      });
    }

    await sendMerchantOrderEmail(merchant, order).catch((e) =>
      console.error("Merchant email failed:", e.message)
    );
  } catch (e) {
    console.error("notifyOrderParties error:", e.message);
  }
}

export const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (!user.location?.coordinates || user.location.coordinates.length !== 2) {
      return res.status(400).json({ success: false, message: "Please set your delivery location" });
    }
    const a = user.address || {};
    if (!a.fullAddress || !a.district || !a.state || !a.pincode) {
      return res.status(400).json({ success: false, message: "Please complete your delivery address" });
    }

    const cart = await Cart.findOne({ user: userId })
      .populate("shop")
      .populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    const shop = cart.shop;
    if (!shop || !shop.isActive) {
      return res.status(400).json({ success: false, message: "This shop is currently unavailable" });
    }
    let subtotal = 0;
    const items = [];
    for (const ci of cart.items) {
      const p = ci.product;
      if (!p || !p.isActive || !p.isAvailable) {
        return res.status(400).json({ success: false, message: `${ci.name} is no longer available` });
      }
      if (p.stock < ci.quantity) {
        return res.status(400).json({ success: false, message: `Only ${p.stock} of ${p.productName} left in stock` });
      }
      const price = p.price;
      const totalPrice = price * ci.quantity;
      subtotal += totalPrice;
      items.push({
        product: p._id,
        name: p.productName,
        image: p.images?.[0] || "",
        price,
        quantity: ci.quantity,
        totalPrice,
      });
    }

    const distance = calculateDistance(
      user.location.coordinates[1],
      user.location.coordinates[0],
      shop.location.coordinates[1],
      shop.location.coordinates[0]
    );
    const deliveryFee = calculateDeliveryFee(distance, subtotal);
    const platformFee = PLATFORM_FEE;
    const totalAmount = subtotal + deliveryFee + platformFee;
    const amountPaise = Math.round(totalAmount * 100);

    const orderId = `SKB-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await Order.deleteMany({
      user: userId,
      paymentStatus: "PENDING",
      createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    // Demo mode settles without a gateway. Checked before the gateway call so an
    // exhibition build never depends on Razorpay being reachable.
    if (demoPaymentEnabled()) {
      const demoOrder = await Order.create({
        orderId,
        user: userId,
        shop: shop._id,
        merchant: shop.owner,
        items,
        subtotal,
        deliveryFee,
        platformFee,
        totalAmount,
        paymentMethod: "DEMO",
        paymentStatus: "PENDING",
        orderStatus: "PENDING",
        deliveryAddress: {
          houseNumber: a.houseNumber,
          landmark: a.landmark,
          village: a.village,
          town: a.town,
          district: a.district,
          state: a.state,
          pincode: a.pincode,
          fullAddress: a.fullAddress,
        },
        location: { type: "Point", coordinates: user.location.coordinates },
        customerPhone: user.phone,
        notes: req.body?.notes,
      });

      return res.status(201).json({
        success: true,
        message: "Demo payment order created",
        data: demoOrderPayload({
          order: demoOrder,
          amountPaise,
          summary: { subtotal, deliveryFee, platformFee, totalAmount, distance: distance.toFixed(2) },
          prefill: { name: user.name, contact: user.phone },
        }),
      });
    }

    const rzpOrder = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: orderId,
      notes: { orderId, userId: String(userId), shopId: String(shop._id) },
    });

    const order = await Order.create({
      orderId,
      user: userId,
      shop: shop._id,
      merchant: shop.owner,
      items,
      subtotal,
      deliveryFee,
      platformFee,
      totalAmount,
      paymentMethod: "RAZORPAY",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      deliveryAddress: {
        houseNumber: a.houseNumber,
        landmark: a.landmark,
        village: a.village,
        town: a.town,
        district: a.district,
        state: a.state,
        pincode: a.pincode,
        fullAddress: a.fullAddress,
      },
      location: { type: "Point", coordinates: user.location.coordinates },
      customerPhone: user.phone,
      notes: req.body?.notes,
      razorpayOrderId: rzpOrder.id,
    });

    res.status(201).json({
      success: true,
      message: "Payment order created",
      data: {
        mode: "razorpay",
        key: process.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amount: amountPaise,
        currency: "INR",
        orderId: order.orderId,
        dbOrderId: order._id,
        summary: {
          subtotal,
          deliveryFee,
          platformFee,
          totalAmount,
          distance: distance.toFixed(2),
        },
        prefill: { name: user.name, contact: user.phone },
      },
    });
  } catch (error) {
    console.error("createPaymentOrder error:", error);

    // A rejected key pair is the most common cause here and it is invisible in a
    // generic 500, so surface it: the client can then tell the user that payment
    // is misconfigured rather than that their order failed.
    const rzpError = error?.error?.description || error?.description;
    const isAuth = error?.statusCode === 401;

    res.status(isAuth ? 503 : 500).json({
      success: false,
      message: isAuth
        ? "Payment gateway is not configured correctly. Check the Razorpay key pair."
        : rzpError || "Could not start payment",
      ...(process.env.NODE_ENV === "production" ? {} : { detail: rzpError }),
    });
  }
};


// Settles a demo order. Only reachable while DEMO_PAYMENT=true, and only for a
// pending DEMO order belonging to the caller - it cannot settle a real gateway
// order, and it cannot settle someone else's.
export const settleDemoPayment = async (req, res) => {
  try {
    if (!demoPaymentEnabled()) {
      return res.status(403).json({
        success: false,
        message: "Demo payment is disabled on this server",
      });
    }

    const order = await Order.findOne({
      user: req.user._id,
      paymentMethod: "DEMO",
      paymentStatus: "PENDING",
    }).sort({ createdAt: -1 });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "No pending demo order found",
      });
    }

    order.paymentStatus = "PAID";
    order.orderStatus = "PLACED";
    order.demoReference = req.body?.demoReference || demoReference();
    order.paidAt = new Date();
    await order.save();

    await Cart.findOneAndUpdate(
      { user: req.user._id },
      { $set: { items: [], shop: null, totalItems: 0, subtotal: 0 } }
    );

    res.status(200).json({
      success: true,
      message: "Demo payment recorded",
      notice: DEMO_NOTICE,
      data: { order },
    });
  } catch (error) {
    console.error("settleDemoPayment error:", error);
    res.status(500).json({ success: false, message: "Could not record demo payment" });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment fields" });
    }

    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
      user: req.user._id,
    });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentStatus === "PAID") {
      return res.status(200).json({ success: true, message: "Already verified", data: { order } });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const sigBuf = Buffer.from(razorpay_signature);
    const expBuf = Buffer.from(expected);
    const valid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!valid) {
      order.paymentStatus = "FAILED";
      await order.save();
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const expectedPaise = Math.round(order.totalAmount * 100);
    try {
      const payment = await getRazorpay().payments.fetch(razorpay_payment_id);
      const sameOrder = payment.order_id === razorpay_order_id;
      const sameAmount = Number(payment.amount) === expectedPaise;
      if (!sameOrder || !sameAmount) {
        order.paymentStatus = "FAILED";
        await order.save();
        return res.status(400).json({ success: false, message: "Payment validation failed" });
      }
      if (payment.status === "authorized") {

        await getRazorpay().payments.capture(razorpay_payment_id, expectedPaise, "INR");
      } else if (payment.status !== "captured") {
        order.paymentStatus = "FAILED";
        await order.save();
        return res.status(400).json({ success: false, message: "Payment not completed" });
      }
    } catch (fetchErr) {

      console.error("payments.fetch/capture error:", fetchErr.message);
    }

    let didFulfill;
    try {
      didFulfill = await fulfillPaidOrder(order, razorpay_payment_id, razorpay_signature);
    } catch (stockErr) {

      try {
        await getRazorpay().payments.refund(razorpay_payment_id, {
          notes: { reason: stockErr.message },
        });
      } catch (refundErr) {
        console.error("Refund failed:", refundErr.message);
      }
      order.paymentStatus = "REFUNDED";
      order.orderStatus = "CANCELLED";
      order.cancelledAt = new Date();
      await order.save();
      return res.status(409).json({
        success: false,
        message: `${stockErr.message}. Your payment has been refunded.`,
      });
    }

    if (didFulfill) notifyOrderParties(order);

    res.status(200).json({
      success: true,
      message: didFulfill ? "Payment verified, order placed" : "Order already confirmed",
      data: { order },
    });
  } catch (error) {
    console.error("verifyPayment error:", error);
    res.status(500).json({ success: false, message: "Payment verification error" });
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return res.status(200).json({ ok: true });

    const signature = req.headers["x-razorpay-signature"] || "";
    const raw = req.body;
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = JSON.parse(raw.toString("utf8"));

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentEntity = event.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
      const paymentId = paymentEntity?.id;
      const paidAmount = paymentEntity?.amount;

      if (rzpOrderId) {
        const order = await Order.findOne({ razorpayOrderId: rzpOrderId });

        const amountOk =
          paidAmount == null || Number(paidAmount) === Math.round((order?.totalAmount || 0) * 100);

        if (order && order.paymentStatus !== "PAID" && amountOk) {
          try {
            const didFulfill = await fulfillPaidOrder(order, paymentId);
            if (didFulfill) notifyOrderParties(order);
          } catch (stockErr) {
            try {
              if (paymentId) {
                await getRazorpay().payments.refund(paymentId, {
                  notes: { reason: stockErr.message },
                });
              }
            } catch (_) {}
            order.paymentStatus = "REFUNDED";
            order.orderStatus = "CANCELLED";
            order.cancelledAt = new Date();
            await order.save();
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("razorpayWebhook error:", error);
    res.status(500).json({ success: false });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
      paymentStatus: { $ne: "PENDING" },
    })
      .populate("shop", "shopName shopLogo")
      .sort("-createdAt")
      .lean();

    res.status(200).json({ success: true, data: { orders } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Combined history: DELIVERED orders + ALL parcels (newest first) ──────────────
export const getMyHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const [orders, parcels] = await Promise.all([
      Order.find({ user: userId, orderStatus: "DELIVERED" })
        .populate("shop", "shopName shopLogo")
        .select("orderId items totalItems totalAmount orderStatus deliveryAddress deliveredAt createdAt shop")
        .sort("-deliveredAt")
        .lean(),
      // ALL parcels, any status (REQUESTED / POOLED / ASSIGNED / … / DELIVERED / CANCELLED)
      Parcel.find({ sender: userId })
        .select("parcelId package totalAmount status drop deliveredAt createdAt")
        .sort("-createdAt")
        .lean(),
    ]);

    const items = [
      ...orders.map((o) => {
        const count = o.totalItems || o.items?.length || 0;
        return {
          kind: "order",
          refId: o.orderId,
          status: o.orderStatus,
          title: o.shop?.shopName || "Order",
          subtitle: `${count} item${count !== 1 ? "s" : ""}`,
          image: o.shop?.shopLogo || null,
          amount: o.totalAmount || 0,
          date: o.deliveredAt || o.createdAt,
        };
      }),
      ...parcels.map((p) => ({
        kind: "parcel",
        refId: p.parcelId,
        status: p.status,
        title: p.package?.type || "Parcel",
        subtitle: p.drop?.address?.fullAddress || "Parcel delivery",
        image: null,
        amount: p.totalAmount || 0,
        date: p.deliveredAt || p.createdAt,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    console.error("getMyHistory error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("shop", "shopName shopLogo phoneNumber address");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (["PICKED", "ON_THE_WAY", "DELIVERED", "CANCELLED"].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: "This order can no longer be cancelled" });
    }

    if (order.paymentStatus === "PAID" && order.razorpayPaymentId) {
      try {
        await getRazorpay().payments.refund(order.razorpayPaymentId, {
          notes: { reason: "Customer cancelled" },
        });
        order.paymentStatus = "REFUNDED";
      } catch (e) {
        console.error("Cancel refund failed:", e.message);
      }
      for (const it of order.items) {
        await Product.updateOne({ _id: it.product }, { $inc: { stock: it.quantity } });
      }
    }

    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
    await order.save();

    res.status(200).json({ success: true, message: "Order cancelled", data: { order } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
