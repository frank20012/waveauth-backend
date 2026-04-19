import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";
import RentOrder from "../models/RentOrder.js";
import {
  getUnifiedServicePricing
} from "../services/catalog.service.js";
import {
  buyRentalActivation,
  checkRentalActivationOtp,
  cancelRentalActivation
} from "../services/rent.service.js";

const generateRefundReference = (orderId) => {
  return `RENT-REFUND-${orderId}-${Date.now()}`;
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");

/* =========================
   GET COUNTRIES
========================= */
export const getRentCountries = async (req, res) => {
  try {
    return res.status(200).json({
      countries: [],
      message:
        "Country list is no longer tied to only SMSPool. Use your frontend country list for now, or later we can build a merged provider-country endpoint."
    });
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
    const { country, service } = req.query;

    if (!country) {
      return res.status(400).json({
        message: "Country is required"
      });
    }

    if (!service) {
      return res.status(200).json({
        services: [],
        message:
          "Pass a service query too, so the backend can compare rental pricing across SMSPool, Tiger, and PVAPins."
      });
    }

    const normalizedCountry = String(country).trim().toUpperCase();
    const normalizedService = normalizeText(service);

    const providerResults = await getUnifiedServicePricing({
      country: normalizedCountry,
      service: normalizedService,
      type: "rental"
    });

    const mapped = providerResults.map((item) => ({
      provider: item.provider,
      id: normalizedService,
      name: normalizedService,
      country: normalizedCountry,
      providerPriceUsd: Number(item.providerPriceUsd || 0),
      price: Number(item.sellingPriceNgn || 0),
      currency: "NGN",
      available: Number(item.stock || 0) > 0,
      count: Number(item.stock || 0),
      status: Number(item.stock || 0) > 0 ? "active" : "inactive",
      error: item.error || null
    }));

    return res.status(200).json({
      services: mapped,
      providers: providerResults
    });
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
    const { countryId, countryName, serviceId, serviceName, operator } = req.body;

    const country = countryId || countryName;
    const service = serviceId || serviceName;

    if (!country || !service) {
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

    const order = await buyRentalActivation({
      userId,
      country: String(country).trim().toUpperCase(),
      service: normalizeText(service),
      operator: operator ? normalizeText(operator) : ""
    });

    const price = Number(order.price || 0);

    if (wallet.balance < price) {
      try {
        await cancelRentalActivation(order._id);
      } catch (err) {
        console.log("Rollback rent cancel failed:", err.message);
      }

      return res.status(400).json({
        message: "Insufficient wallet balance"
      });
    }

    wallet.balance -= price;
    await wallet.save();

    await Transaction.create({
      user: userId,
      wallet: wallet._id,
      type: "debit",
      amount: price,
      status: "completed",
      reference: `RENT-${order._id}`,
      description: `Rent number for ${serviceName || service} (${countryName || country})`
    });

    return res.status(201).json({
      message: "Number rented successfully",
      order,
      walletBalance: wallet.balance
    });
  } catch (error) {
    console.log("RENT ERROR:", error.message);

    return res.status(500).json({
      message: error.message || "Failed to rent number"
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

    const updatedOrder = await checkRentalActivationOtp(order._id);

    return res.status(200).json({
      order: updatedOrder
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

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found"
      });
    }

    const { order: cancelledOrder, providerResult } =
      await cancelRentalActivation(order._id);

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
        description: `Refund for cancelled rent order (${cancelledOrder.serviceName})`
      });
    }

    return res.json({
      message: shouldRefund
        ? "Order cancelled and refunded"
        : "Order cancelled",
      refunded: shouldRefund,
      providerCancelWorked: providerResult.success,
      order: cancelledOrder,
      walletBalance: wallet.balance
    });
  } catch (error) {
    console.log("CANCEL RENT ERROR:", error.message);

    return res.status(500).json({
      message: "Cancel failed"
    });
  }
};