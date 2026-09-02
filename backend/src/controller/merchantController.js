import jwt from "jsonwebtoken";
import Merchant from "../models/merchant.model.js";

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

export const registerMerchant = async (req,res) => {
  try {
    const {
      name,
      phone,
      email,
      businessName,
      aadhaarNumber,
      panNumber,
      gstNumber,
    } = req.body;

    const existingMerchant =
      await Merchant.findOne({ phone });

    if (existingMerchant) {
      return res.status(400).json({
        success: false,
        message: "Merchant already exists",
      });
    }

    const merchant = await Merchant.create({
      name,
      phone,
      email,
      businessName,
      aadhaarNumber,
      panNumber,
      gstNumber,
    });

    const token = generateToken(
      merchant._id.toString()
    );

    res.status(201).json({
      success: true,
      message:
        "Merchant registered successfully",

      token,

      merchant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const loginMerchant = async (req,res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const merchant = await Merchant.findOne({ phone });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    const token = generateToken(
      merchant._id.toString()
    );

    res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      merchant,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMe = async (
  req,
  res
) => {
  try {
    const merchant = req.merchant;

    res.status(200).json({
      success: true,

      message: "Merchant fetched successfully",

      merchant: {
        _id: merchant._id,

        name: merchant.name,

        phone: merchant.phone,

        email: merchant.email,

        businessName:
          merchant.businessName,

        role: merchant.role,

        isVerified:
          merchant.isVerified,

        kycVerified:
          merchant.kycVerified,

        aadhaarNumber:
          merchant.aadhaarNumber,

        panNumber:
          merchant.panNumber,

        gstNumber:
          merchant.gstNumber,

        shops: merchant.shops,

        walletBalance:
          merchant.walletBalance,

        totalOrders:
          merchant.totalOrders,

        isBlocked:
          merchant.isBlocked,

        lastActive:
          merchant.lastActive,

        createdAt:
          merchant.createdAt,

        updatedAt:
          merchant.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,

      message: error.message,
    });
  }
};

export const saveExpoToken = async (req, res) => {
  try {
    const token = req.body?.token || req.body?.expoPushToken;
    const platform = req.body?.platform;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Push token is required",
      });
    }

    const result = await saveToken(Merchant, req.merchant._id, token, platform);

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.reason,
      });
    }

    res.status(200).json({
      success: true,
      message: "Push token saved successfully",
      platform: result.kind,
    });
  } catch (error) {
    console.error("Error saving push token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save push token",
    });
  }
};

export const verifyMerchant = async (req, res) => {
  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const merchant = await Merchant.findById(decoded.id);

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Merchant verified successfully",
      merchant,
    });

  } catch (error) {

    console.log("Verify Merchant Error:", error);

    res.status(500).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
