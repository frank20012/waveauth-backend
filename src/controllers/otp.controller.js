import mongoose from "mongoose";
import OtpOrder from "../models/OtpOrder.js";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import {
  getTemporaryActivationQuote,
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

const toMoneyNumber = (value) => Number(value || 0);

export const buyOtpNumber = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = req.user._id;
    const { country, serviceName, operator } = req.body;

    if (!country || !serviceName) {
      return res.status(400).json({
        message: "Country and service name are required"
      });
    }

    const normalizedCountry = String(country).trim().toUpperCase();
    const normalizedService = normalizeText(serviceName);
    const normalizedOperator = operator ? normalizeText(operator) : "";

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const quote = await getTemporaryActivationQuote({
      country: normalizedCountry,
      service: normalizedService,
      operator: normalizedOperator
    });

    if (!quote || !quote.available) {
      return res.status(400).json({
        message:
          quote?.message ||
          "No provider could supply this temporary number right now"
      });
    }

    const estimatedPrice = toMoneyNumber(quote.sellingPrice);
    const currentWalletBalance = toMoneyNumber(wallet.balance);

    if (!estimatedPrice || estimatedPrice <= 0) {
      return res.status(400).json({
        message: "Could not determine final price for this order"
      });
    }

    if (currentWalletBalance < estimatedPrice) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        requiredAmount: estimatedPrice,
        walletBalance: currentWalletBalance,
        shortfall: Math.max(estimatedPrice - currentWalletBalance, 0)
      });
    }

    let reservedWallet = null;

    await session.withTransaction(async () => {
      reservedWallet = await Wallet.findOneAndUpdate(
        {
          user: userId,
          balance: { $gte: estimatedPrice }
        },
        {
          $inc: { balance: -estimatedPrice }
        },
        {
          new: true,
          session
        }
      );

      if (!reservedWallet) {
        throw new Error("Insufficient wallet balance");
      }
    });

    let order = null;

    try {
      order = await buyTemporaryActivation({
        userId,
        country: normalizedCountry,
        service: normalizedService,
        operator: normalizedOperator
      });
    } catch (error) {
      await Wallet.findOneAndUpdate(
        { user: userId },
        { $inc: { balance: estimatedPrice } },
        { new: true }
      );

      return res.status(400).json({
        message: error.message || "Failed to purchase number from provider"
      });
    }

    const finalPrice = toMoneyNumber(order.price || estimatedPrice);

    if (!finalPrice || finalPrice <= 0) {
      try {
        await cancelTemporaryActivation(order._id);
      } catch (err) {
        console.log("Cancel after invalid final price failed:", err.message);
      }

      await Wallet.findOneAndUpdate(
        { user: userId },
        { $inc: { balance: estimatedPrice } },
        { new: true }
      );

      return res.status(400).json({
        message: "Could not determine final charge after provider purchase"
      });
    }

    if (finalPrice > estimatedPrice) {
      const extraNeeded = finalPrice - estimatedPrice;

      const updatedWallet = await Wallet.findOneAndUpdate(
        {
          user: userId,
          balance: { $gte: extraNeeded }
        },
        {
          $inc: { balance: -extraNeeded }
        },
        {
          new: true
        }
      );

      if (!updatedWallet) {
        try {
          await cancelTemporaryActivation(order._id);
        } catch (err) {
          console.log("Rollback cancel failed:", err.message);
        }

        await Wallet.findOneAndUpdate(
          { user: userId },
          { $inc: { balance: estimatedPrice } },
          { new: true }
        );

        return res.status(400).json({
          message: "Insufficient wallet balance for final provider price",
          requiredAmount: finalPrice
        });
      }
    } else if (finalPrice < estimatedPrice) {
      const refundDifference = estimatedPrice - finalPrice;

      await Wallet.findOneAndUpdate(
        { user: userId },
        { $inc: { balance: refundDifference } },
        { new: true }
      );
    }

    // CRITICAL: mark order as truly paid only after wallet charge succeeds
    order.walletDebited = true;
    order.chargedAmount = finalPrice;
    order.refundProcessed = false;
    order.refundedAmount = 0;
    await order.save();

    const freshWallet = await Wallet.findOne({ user: userId });

    await Transaction.create({
      user: userId,
      wallet: freshWallet._id,
      type: "debit",
      amount: finalPrice,
      status: "completed",
      reference: `OTP-${order._id}`,
      description: `Purchased ${serviceName} number for ${country}`
    });

    return res.status(201).json({
      message: "Number purchased successfully",
      order,
      walletBalance: toMoneyNumber(freshWallet.balance)
    });
  } catch (error) {
    console.error("BUY ORDER ERROR:", error.message);

    return res.status(500).json({
      message: error.message || "Failed to purchase number"
    });
  } finally {
    await session.endSession();
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

    const refundAmount = Number(cancelledOrder.chargedAmount || 0);

    // CRITICAL FIX:
    // Refund only if wallet was actually debited,
    // refund was not already processed,
    // provider cancel worked,
    // and OTP was not received.
    const shouldRefund =
      providerResult.success &&
      !cancelledOrder.otpCode &&
      cancelledOrder.walletDebited === true &&
      cancelledOrder.refundProcessed !== true &&
      refundAmount > 0;

    if (shouldRefund) {
      wallet.balance += refundAmount;
      await wallet.save();

      cancelledOrder.refundProcessed = true;
      cancelledOrder.refundedAmount = refundAmount;
      await cancelledOrder.save();

      await Transaction.create({
        user: req.user._id,
        wallet: wallet._id,
        type: "refund",
        amount: refundAmount,
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