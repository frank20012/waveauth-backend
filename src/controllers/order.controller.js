import OtpOrder from "../models/OtpOrder.js";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import {
  buyActivationNumber,
  checkActivationOrder,
  cancelActivationOrder,
  getPricesByCountry
} from "../services/fivesim.service.js";
import { getUsdToNgnRate, calculateSellingPriceNaira } from "../utils/pricing.js";

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
    const { country, serviceName } = req.body;

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

    const usdToNgnRate = await getUsdToNgnRate();
    const providerPrices = await getPricesByCountry(country);

    const serviceData =
      providerPrices?.[country?.toLowerCase()]?.[serviceName?.toLowerCase()];

    if (!serviceData) {
      return res.status(400).json({
        message: "Service not available for this country"
      });
    }

    let cheapest = null;

    Object.values(serviceData).forEach((op) => {
      const cost = Number(op?.cost || 0);
      if (cheapest === null || cost < cheapest) {
        cheapest = cost;
      }
    });

    const estimatedPrice = calculateSellingPriceNaira(
      cheapest || 0,
      usdToNgnRate
    );

    if (wallet.balance < estimatedPrice) {
      return res.status(400).json({
        message: "Insufficient wallet balance"
      });
    }

    const providerOrder = await buyActivationNumber({
      country: normalizeText(country),
      product: normalizeText(serviceName),
      operator: "any"
    });

    console.log("PROVIDER ORDER RESPONSE:", providerOrder);

    if (
      !providerOrder ||
      providerOrder === "no free phones" ||
      providerOrder?.message === "no free phones" ||
      !providerOrder?.id ||
      !providerOrder?.phone
    ) {
      return res.status(400).json({
        message: "Service is currently out of stock. Try another service or country."
      });
    }

    const actualUsd = Number(providerOrder.price || cheapest || 0);
    const finalPrice = calculateSellingPriceNaira(actualUsd, usdToNgnRate);

    if (wallet.balance < finalPrice) {
      try {
        await cancelActivationOrder(providerOrder.id);
      } catch (err) {
        console.log("Cancel failed:", err.message);
      }

      return res.status(400).json({
        message: "Insufficient balance for live price"
      });
    }

    const order = await OtpOrder.create({
      user: userId,
      assignedNumber: providerOrder.phone,
      price: finalPrice,
      provider: "5sim",
      providerOrderId: String(providerOrder.id),
      providerOperator: providerOrder.operator || "any",
      providerCost: actualUsd,
      serviceName,
      country,
      status: "active"
    });

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
      order
    });
  } catch (error) {
    console.error("BUY ORDER ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      message: error.response?.data?.message || error.message
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

    const providerData = await checkActivationOrder(order.providerOrderId);

    if (providerData.sms?.length > 0) {
      order.otpCode = providerData.sms[0].code;
      order.status = "completed";
    }

    await order.save();

    res.json({ order });
  } catch (error) {
    res.status(500).json({ message: "Failed to check order" });
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

    let providerCancelWorked = false;

    try {
      if (order.providerOrderId) {
        await cancelActivationOrder(order.providerOrderId);
        providerCancelWorked = true;
      }
    } catch (error) {
      console.log("Provider cancel failed:", error.message);
    }

    const shouldRefund = !order.otpCode;

    if (shouldRefund) {
      wallet.balance += Number(order.price || 0);
      await wallet.save();

      await Transaction.create({
        user: req.user._id,
        wallet: wallet._id,
        type: "refund",
        amount: Number(order.price || 0),
        status: "completed",
        reference: generateRefundReference(order._id),
        description: `Refund for cancelled order ${order.serviceName} (${order.country})`
      });
    }

    order.status = "cancelled";
    await order.save();

    return res.json({
      message: shouldRefund
        ? "Order cancelled and amount refunded successfully"
        : "Order cancelled successfully",
      refunded: shouldRefund,
      providerCancelWorked,
      order,
      walletBalance: wallet.balance
    });
  } catch (error) {
    console.log("Cancel failed:", error.message);
    res.status(500).json({
      message: "Cancel failed"
    });
  }
};