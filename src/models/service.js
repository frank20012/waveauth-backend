import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    serviceCode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ["otp", "sms", "voice", "renewal", "replacement"],
      default: "otp"
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryType: {
      type: String,
      enum: ["sms", "voice"],
      default: "sms"
    },
    durationHours: {
      type: Number,
      default: 2,
      min: 1
    },
    status: {
      type: String,
      enum: ["active", "draft", "disabled"],
      default: "active"
    },
    description: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;