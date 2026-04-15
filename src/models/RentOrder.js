import mongoose from "mongoose";

const rentOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    country: {
      type: String,
      default: ""
    },
    serviceName: {
      type: String,
      default: ""
    },
    serviceId: {
      type: String,
      default: ""
    },
    countryId: {
      type: String,
      default: ""
    },
    provider: {
      type: String,
      default: "smspool"
    },
    providerOrderId: {
      type: String,
      default: ""
    },
    assignedNumber: {
      type: String,
      default: ""
    },
    otpCode: {
      type: String,
      default: ""
    },
    providerCostUsd: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "expired", "failed"],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

const RentOrder = mongoose.model("RentOrder", rentOrderSchema);

export default RentOrder;