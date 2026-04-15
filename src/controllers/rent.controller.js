import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import RentOrder from "../models/RentOrder.js";
import {
  getSmsPoolCountries,
  getSmsPoolServices,
  purchaseSmsPoolNumber,
  checkSmsPoolOrder
} from "../services/smspool.service.js";
import { getUsdToNgnRate, calculateSellingPriceNaira } from "../utils/pricing.js";

const generateRefundReference = (orderId) => {
  return `RENT-REFUND-${orderId}-${Date.now()}`;
};

/* =========================
   GET COUNTRIES
========================= */
export const getRentCountries = async (req, res) => {
  try {
    const data = await getSmsPoolCountries();
    return res.status(200).json({ countries: data || [] });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch rent countries"
    });
  }
};

/* =========================
   GET SERVICES + PRICING
========================= */
export const getRentServices = async (req, res) => {
  try {
    const { country } = req.query;

    if (!country) {
      return res.status(400).json({
        message: "Country is required"
      });
    }

    const [services, rate] = await Promise.all([
      getSmsPoolServices(country),
      getUsdToNgnRate()
    ]);

    const mapped = (services || []).map((item) => {
      const usd = Number(item.price || 0);

      return {
        id: item.ID || item.id || item.service,
        name: item.name || item.service,
        providerPriceUsd: usd,
        price: calculateSellingPriceNaira(usd, rate),
        currency: "NGN"
      };
    });

    return res.status(200).json({ services: mapped });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch services"
    });
  }
};

/* =========================
   CREATE RENT ORDER
========================= */
export const createRentOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { countryId, countryName, serviceId, serviceName, displayedPrice } = req.body;

    if (!countryId || !serviceId) {
      return res.status(400).json({
        message: "Country and service are required"
      });
    }

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const price = Number(displayedPrice || 0);

    if (!price || wallet.balance < price) {
      return res.status(400).json({
        message: "Insufficient wallet balance"
      });
    }

    const providerResponse = await purchaseSmsPoolNumber({
      country: countryId,
      service: serviceId,
      quantity: 1
    });

    console.log("SMSPOOL BUY RESPONSE:", providerResponse);

    const orderData = Array.isArray(providerResponse)
      ? providerResponse[0]
      : providerResponse;

    const providerOrderId =
      orderData?.order_code ||
      orderData?.orderid ||
      orderData?.id;

    const number =
      orderData?.phonenumber ||
      orderData?.number;

    if (!providerOrderId || !number) {
      return res.status(400).json({
        message: "No number available right now"
      });
    }

    const order = await RentOrder.create({
      user: userId,
      country: countryName,
      serviceName,
      serviceId,
      countryId,
      provider: "smspool",
      providerOrderId,
      assignedNumber: number,
      price,
      status: "active"
    });

    wallet.balance -= price;
    await wallet.save();

    await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "debit",
      amount: price,
      status: "completed",
      reference: `RENT-${order._id}`,
      description: `Rent number for ${serviceName} (${countryName})`
    });

    return res.status(201).json({
      message: "Number rented successfully",
      order
    });
  } catch (error) {
    console.log("RENT ERROR:", error.message);

    return res.status(500).json({
      message: "Failed to rent number"
    });
  }
};

/* =========================
   GET USER RENT ORDERS
========================= */
export const getMyRentOrders = async (req, res) => {
  try {
    const orders = await RentOrder.find({ user: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch rent orders"
    });
  }
};

/* =========================
   CHECK OTP STATUS
========================= */
export const checkRentOrderStatus = async (req, res) => {
  try {
    const order = await RentOrder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    const providerData = await checkSmsPoolOrder(order.providerOrderId);

    if (providerData?.sms || providerData?.code) {
      order.otpCode = String(providerData.sms || providerData.code);
      order.status = "completed";
    }

    await order.save();

    return res.status(200).json({
      order
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to check order"
    });
  }
};

/* =========================
   CANCEL + REFUND
========================= */
export const cancelRentOrder = async (req, res) => {
  try {
    const order = await RentOrder.findOne({
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
      order.status === "completed" ||
      order.status === "expired"
    ) {
      return res.status(400).json({
        message: "Order cannot be cancelled"
      });
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

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
        description: `Refund for cancelled rent order (${order.serviceName})`
      });
    }

    order.status = "cancelled";
    await order.save();

    return res.json({
      message: shouldRefund
        ? "Order cancelled and refunded"
        : "Order cancelled",
      refunded: shouldRefund,
      order
    });
  } catch (error) {
    console.log("CANCEL RENT ERROR:", error.message);

    return res.status(500).json({
      message: "Cancel failed"
    });
  }
};