import mongoose from "mongoose";

const merchantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
    },

    businessName: {
      type: String,
      trim: true,
    },

    role: {
      type: String,
      default: "merchant",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    kycVerified: {
      type: Boolean,
      default: false,
    },

    aadhaarNumber: {
      type: String,
      trim: true,
    },

    panNumber: {
      type: String,
      trim: true,
    },

    gstNumber: {
      type: String,
      trim: true,
    },

    shops: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Shop",
      },
    ],

    walletBalance: {
      type: Number,
      default: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
    expoPushToken: {
        type: String,
    },
    fcmToken: {
      type: String,
    },
    pushPlatform: {
      type: String,
      enum: ["expo", "android", "ios"],
    },

    lastActive: Date,
  },
  {
    timestamps: true,
  }
);

const Merchant = mongoose.model("Merchant",merchantSchema);

export default Merchant;
