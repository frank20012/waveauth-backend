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
      enum: ["smspool", "tiger", "pvapins", "5sim"],
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
    rawProviderResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    status: {
      type: String,
      enum: [
        "pending",
        "active",
        "waiting_sms",
        "completed",
        "cancelled",
        "expired",
        "failed"
      ],
      default: "pending"
    }
  },
  {
    timestamps: true
  }
);

const RentOrder = mongoose.model("RentOrder", rentOrderSchema);

export default RentOrder;