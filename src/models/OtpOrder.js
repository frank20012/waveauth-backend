import mongoose from "mongoose";

const otpOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    serviceName: {
      type: String,
      default: ""
    },
    country: {
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
    price: {
      type: Number,
      required: true,
      default: 0
    },
    provider: {
      type: String,
      enum: ["smspool", "juicysms", "tiger", "pvapins", "5sim"],
      default: "smspool"
    },
    providerOrderId: {
      type: String,
      default: ""
    },
    providerOperator: {
      type: String,
      default: "any"
    },
    providerCost: {
      type: Number,
      default: 0
    },
    rawProviderResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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
    },
    walletDebited: {
      type: Boolean,
      default: false
    },
    chargedAmount: {
      type: Number,
      default: 0
    },
    refundProcessed: {
      type: Boolean,
      default: false
    },
    refundedAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const OtpOrder = mongoose.model("OtpOrder", otpOrderSchema);

export default OtpOrder;