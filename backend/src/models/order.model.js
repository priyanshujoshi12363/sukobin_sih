import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Merchant",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    platformFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "UPI", "COD", "DEMO"],
      default: "RAZORPAY",
    },

    demoReference: { type: String },
    paidAt: { type: Date },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
      ],
      default: "PENDING",
    },

    razorpayOrderId: {
      type: String,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    paidAt: {
      type: Date,
    },

    orderStatus: {
      type: String,
      enum: [
        "PENDING",
        "PLACED",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "PICKED",
        "ON_THE_WAY",
        "DELIVERED",
        "CANCELLED",
      ],
      default: "PENDING",
    },

    deliveryAddress: {
      houseNumber: {
        type: String,
        trim: true,
      },

      landmark: {
        type: String,
        trim: true,
      },

      village: {
        type: String,
        trim: true,
      },

      town: {
        type: String,
        trim: true,
      },

      district: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      pincode: {
        type: String,
        required: true,
        trim: true,
      },

      fullAddress: {
        type: String,
        required: true,
        trim: true,
      },
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],
        required: true,
      },
    },

    customerPhone: {
      type: String,
      required: true,
      trim: true,
    },

    // ── delivery partner assignment (route-matching engine) ──
    assignedPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Partner",
      default: null,
    },
    assignedAt: Date,
    deliveryOtp: { type: String },

    // real road route shop → customer (set when the order becomes pickable)
    routePolyline: { type: [[Number]], default: undefined },
    routeDistanceKm: { type: Number, default: 0 },
    routeDurationMin: { type: Number, default: 0 },
    driverNearNotified: { type: Boolean, default: false },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    estimatedDeliveryTime: {
      type: Date,
    },

    acceptedAt: Date,

    readyAt: Date,

    pickedAt: Date,

    deliveredAt: Date,

    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

orderSchema.index({
  location: "2dsphere",
});

// fast lookups for a partner's assigned/delivered jobs (stats + active trip)
orderSchema.index({ assignedPartner: 1, orderStatus: 1 });

const Order = mongoose.model(
  "Order",
  orderSchema
);

export default Order;
