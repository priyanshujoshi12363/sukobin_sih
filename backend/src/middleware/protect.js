import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Merchant from "../models/merchant.model.js";
import Partner from "../models/partner.model.js";
import FieldOfficer from "../models/fieldOfficer.model.js";

export const partnerProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const partner = await Partner.findById(decoded.id);
    if (!partner) {
      return res.status(401).json({ success: false, message: "Partner not found" });
    }
    if (partner.isBlocked) {
      return res.status(403).json({ success: false, message: "Account blocked" });
    }
    req.partner = partner;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
export const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-__v");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const merchantProtect = async (req,res,next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith(
        "Bearer"
      )
    ) {
      token =
        req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );
    const merchant =
      await Merchant.findById(decoded.id);

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found",
      });
    }
    req.merchant = merchant;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

export default merchantProtect;

export const officerProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "officer") {
      return res.status(403).json({ success: false, message: "Not an officer token" });
    }

    const officer = await FieldOfficer.findById(decoded.id);
    if (!officer) {
      return res.status(401).json({ success: false, message: "Officer not found" });
    }
    if (officer.isBlocked || !officer.isActive) {
      return res.status(403).json({ success: false, message: "Account is not active" });
    }

    officer.lastActiveAt = new Date();
    await officer.save();

    req.officer = officer;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

// Verification and manual status overrides move real traffic, so they are
// restricted to STATE/REGION level officers.
export const seniorOfficer = (req, res, next) => {
  if (!req.officer?.canVerifyIncidents) {
    return res.status(403).json({
      success: false,
      message: "Only state or regional officers can confirm reports",
    });
  }
  next();
};
