import mongoose from "mongoose";

const numberInventorySchema = new mongoose.Schema(
  {
    country: {
      type: String,
      required: true,
      trim: true
    },
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    provider: {
      type: String,
      default: "internal",
      trim: true
    },
    serviceType: {
      type: String,
      enum: ["otp", "sms", "voice"],
      default: "otp"
    },
    status: {
      type: String,
      enum: ["available", "assigned", "used", "disabled"],
      default: "available"
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

const NumberInventory = mongoose.model("NumberInventory", numberInventorySchema);

export default NumberInventory;