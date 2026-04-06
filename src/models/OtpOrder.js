import mongoose from "mongoose";

const otpOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true
    },
    numberInventory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NumberInventory",
      required: true
    },
    assignedNumber: {
      type: String,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["pending", "active", "completed", "cancelled", "expired"],
      default: "pending"
    },
    otpCode: {
      type: String,
      default: ""
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const OtpOrder = mongoose.model("OtpOrder", otpOrderSchema);

export default OtpOrder;