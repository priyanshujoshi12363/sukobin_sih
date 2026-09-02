import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },

    address: {
      houseNumber: String,
      landmark: String,
      village: String,
      town: String,
      district: String,
      state: String,
      pincode: String,
      fullAddress: String,
    },

    totalOrders: {
      type: Number,
    },

    rating: {
      type: Number,

    },

    isVerified: {
      type: Boolean,

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
  },
  {
    timestamps: true,
  }
);

userSchema.index({ location: "2dsphere" });

const User = mongoose.model("User", userSchema);

export default User;
