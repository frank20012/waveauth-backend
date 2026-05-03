import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true
    },
    type: {
      type: String,
      enum: ["credit", "debit", "refund"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending"
    },
    reference: {
      type: String,
      required: true,
      unique: true
    },
    paymentProvider: {
      type: String,
      default: ""
    },
    providerStatus: {
      type: String,
      default: ""
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;