import OtpOrder from "../models/OtpOrder.js";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import {
  buyTemporaryActivation,
  checkTemporaryActivationOtp,
  cancelTemporaryActivation
} from "../services/activation.service.js";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");

const generateRefundReference = (orderId) => {
  return `REFUND-${orderId}-${Date.now()}`;
};

export const buyOtpNumber = async (req, res) => {
  try {
    const userId = req.user._id;
    const { country, serviceName, operator } = req.body;

    if (!country || !serviceName) {
      return res.status(400).json({
        message: "Country and service name are required"
      });
    }

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const order = await buyTemporaryActivation({
      userId,
      country: String(country).trim().toUpperCase(),
      service: normalizeText(serviceName),
      operator: operator ? normalizeText(operator) : ""
    });

    const finalPrice = Number(order.price || 0);

    if (wallet.balance < finalPrice) {
      try {
        await cancelTemporaryActivation(order._id);
      } catch (err) {
        console.log("Rollback cancel failed:", err.message);
      }

      return res.status(400).json({
        message: "Insufficient wallet balance"
      });
    }

    wallet.balance -= finalPrice;
    await wallet.save();

    await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "debit",
      amount: finalPrice,
      status: "completed",
      reference: `OTP-${order._id}`,
      description: `Purchased ${serviceName} number for ${country}`
    });

    return res.status(201).json({
      message: "Number purchased successfully",
      order,
      walletBalance: wallet.balance
    });
  } catch (error) {
    console.error("BUY ORDER ERROR:", error.message);

    return res.status(500).json({
      message: error.message || "Failed to purchase number"
    });
  }
};

export const getMyOtpOrders = async (req, res) => {
  try {
    const orders = await OtpOrder.find({ user: req.user._id }).sort({
      createdAt: -1
    });

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

export const checkOtpOrderStatus = async (req, res) => {
  try {
    const order = await OtpOrder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.providerOrderId) {
      return res.status(400).json({
        message: "Provider order ID missing"
      });
    }

    const updatedOrder = await checkTemporaryActivationOtp(order._id);

    return res.json({ order: updatedOrder });
  } catch (error) {
    console.log("Check order failed:", error.message);
    return res.status(500).json({ message: "Failed to check order" });
  }
};

export const cancelOtpOrder = async (req, res) => {
  try {
    const order = await OtpOrder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    if (
      order.status === "cancelled" ||
      order.status === "expired" ||
      order.status === "completed"
    ) {
      return res.status(400).json({
        message: "This order can no longer be cancelled"
      });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const { order: cancelledOrder, providerResult } =
      await cancelTemporaryActivation(order._id);

    const shouldRefund =
      providerResult.success && !cancelledOrder.otpCode;

    if (shouldRefund) {
      wallet.balance += Number(cancelledOrder.price || 0);
      await wallet.save();

      await Transaction.create({
        user: req.user._id,
        wallet: wallet._id,
        type: "refund",
        amount: Number(cancelledOrder.price || 0),
        status: "completed",
        reference: generateRefundReference(cancelledOrder._id),
        description: `Refund for cancelled order ${cancelledOrder.serviceName} (${cancelledOrder.country})`
      });
    }

    return res.json({
      message: shouldRefund
        ? "Order cancelled and amount refunded successfully"
        : "Order cancelled successfully",
      refunded: shouldRefund,
      providerCancelWorked: providerResult.success,
      order: cancelledOrder,
      walletBalance: wallet.balance
    });
  } catch (error) {
    console.log("Cancel failed:", error.message);
    res.status(500).json({
      message: "Cancel failed"
    });
  }
};