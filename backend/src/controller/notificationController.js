import User from "../models/user.model.js";
import Partner from "../models/partner.model.js";
import Merchant from "../models/merchant.model.js";
import { sendHelloNotification, sendPush } from "../utils/notification.js";
import { saveToken } from "../utils/pushTokens.js";

export const notification = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user?._id;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const result = await saveToken(User, userId, token, platform);

    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    res.json({
      success: true,
      message: "Push token saved successfully",
      platform: result.kind,
    });
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({ success: false, message: "Failed to save push token" });
  }
};

export const savePartnerToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const result = await saveToken(Partner, req.partner?._id, token, platform);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    res.json({ success: true, message: "Push token saved", platform: result.kind });
  } catch (error) {
    console.error("Error saving partner push token:", error);
    res.status(500).json({ success: false, message: "Failed to save push token" });
  }
};

export const saveMerchantToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const result = await saveToken(Merchant, req.merchant?._id, token, platform);
    if (!result.ok) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    res.json({ success: true, message: "Push token saved", platform: result.kind });
  } catch (error) {
    console.error("Error saving merchant push token:", error);
    res.status(500).json({ success: false, message: "Failed to save push token" });
  }
};

export const sendHelloNotificationApi = async (req, res) => {
  try {
    const token = req.body?.token || req.body?.expoPushToken;

    if (!token) {
      return res.status(400).json({ success: false, message: "Push token is required" });
    }

    const result = await sendHelloNotification(token);

    res.json({
      success: true,
      message: "Hello notification sent successfully",
      result,
    });
  } catch (error) {
    console.error("Error sending hello notification:", error);

    if (error.message === "Invalid push token") {
      return res.status(400).json({ success: false, message: "Invalid push token" });
    }

    res.status(500).json({ success: false, message: "Failed to send notification" });
  }
};

export const testPush = async (req, res) => {
  try {
    const { token, title, body, data } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: "Push token is required" });
    }

    const result = await sendPush(token, {
      title: title || "Sukobin",
      body: body || "Test notification",
      data: data || {},
    });

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
