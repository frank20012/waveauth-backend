import User from "../models/user.js";
import Service from "../models/service.js";
import OtpOrder from "../models/OtpOrder.js";
import Transaction from "../models/transaction.js";
import Ticket from "../models/Ticket.js";

const toMoneyNumber = (value) => Number(value || 0);

const getUserDisplayName = (user) => {
  if (!user) return "-";

  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || user.email || "-";
};
export const getAdminServices = async (req, res, next) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Admin services fetched successfully",
      count: services.length,
      services
    });
  } catch (error) {
    next(error);
  }
};

export const createAdminService = async (req, res, next) => {
  try {
    const {
      name,
      serviceCode,
      country,
      price,
      category,
      deliveryType,
      status,
      description
    } = req.body;

    if (!name || !serviceCode || !country || Number(price) <= 0) {
      return res.status(400).json({
        message: "Name, service code, country, and valid price are required"
      });
    }

    const service = await Service.create({
      name: String(name).trim(),
      serviceCode: String(serviceCode).trim().toLowerCase(),
      country: String(country).trim(),
      price: Number(price),
      category: category || "otp",
      deliveryType: deliveryType || "sms",
      status: status || "active",
      description: description || ""
    });

    return res.status(201).json({
      message: "Service created successfully",
      service
    });
  } catch (error) {
    next(error);
  }
};
const buildOrderResponse = (order) => {
  const plainOrder = order.toObject ? order.toObject() : order;

  return {
    ...plainOrder,
    serviceName: plainOrder.serviceName || plainOrder.service?.name || "Service",
    assignedNumber:
      plainOrder.assignedNumber ||
      plainOrder.numberInventory?.number ||
      "",
    price: toMoneyNumber(plainOrder.price || plainOrder.chargedAmount || 0),
    userDisplayName: getUserDisplayName(plainOrder.user)
  };
};

export const getAdminOverview = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalServices,
      totalOrders,
      totalTransactions,
      totalTickets,
      recentUsers,
      recentOrders,
      recentTickets
    ] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      OtpOrder.countDocuments(),
      Transaction.countDocuments(),
      Ticket.countDocuments(),
      User.find().select("-password").sort({ createdAt: -1 }).limit(5),
      OtpOrder.find()
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(5),
      Ticket.find()
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    return res.status(200).json({
      message: "Admin overview fetched successfully",
      stats: {
        totalUsers,
        totalServices,
        totalOrders,
        totalTransactions,
        totalTickets
      },
      recentUsers,
      recentOrders: recentOrders.map(buildOrderResponse),
      recentTickets
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await OtpOrder.find()
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Admin orders fetched successfully",
      count: orders.length,
      orders: orders.map(buildOrderResponse)
    });
  } catch (error) {
    next(error);
  }
};

export const updateAdminOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, otpCode } = req.body;

    const allowedStatuses = [
      "pending",
      "active",
      "waiting_sms",
      "completed",
      "cancelled",
      "expired",
      "failed"
    ];

    const order = await OtpOrder.findById(id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found"
      });
    }

    if (status) {
      const normalizedStatus = String(status).trim().toLowerCase();

      if (!allowedStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          message: "Invalid order status"
        });
      }

      order.status = normalizedStatus;
    }

    if (typeof otpCode !== "undefined") {
      order.otpCode = String(otpCode || "").trim();

      if (order.otpCode && order.status !== "cancelled" && order.status !== "expired") {
        order.status = "completed";
      }
    }

    await order.save();

    const updatedOrder = await OtpOrder.findById(order._id).populate(
      "user",
      "firstName lastName email"
    );

    return res.status(200).json({
      message: "Order updated successfully",
      order: buildOrderResponse(updatedOrder)
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminReports = async (req, res, next) => {
  try {
    const [users, orders, transactions, services, tickets] = await Promise.all([
      User.find().select("-password"),
      OtpOrder.find(),
      Transaction.find(),
      Service.find(),
      Ticket.find()
    ]);

    const totalRevenue = transactions
      .filter((transaction) => transaction.type === "debit" && transaction.status === "completed")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const totalCredits = transactions
      .filter((transaction) => transaction.type === "credit" && transaction.status === "completed")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const totalRefunds = transactions
      .filter((transaction) => transaction.type === "refund" && transaction.status === "completed")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    const activeUsers = users.filter((user) => user.isActive !== false).length;
    const openTickets = tickets.filter((ticket) => ticket.status === "open").length;
    const reviewTickets = tickets.filter((ticket) => ticket.status === "review").length;
    const resolvedTickets = tickets.filter((ticket) => ticket.status === "resolved").length;

    const serviceMap = {};

    orders.forEach((order) => {
      const serviceName = order.serviceName || "Unknown Service";
      serviceMap[serviceName] = (serviceMap[serviceName] || 0) + 1;
    });

    const topServices = Object.entries(serviceMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentMonths = {};

    transactions.forEach((transaction) => {
      const date = new Date(transaction.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

      if (!recentMonths[key]) {
        recentMonths[key] = {
          label: date.toLocaleString("en-US", {
            month: "long",
            year: "numeric"
          }),
          revenue: 0,
          credits: 0,
          refunds: 0,
          transactions: 0
        };
      }

      recentMonths[key].transactions += 1;

      if (transaction.type === "debit" && transaction.status === "completed") {
        recentMonths[key].revenue += Number(transaction.amount || 0);
      }

      if (transaction.type === "credit" && transaction.status === "completed") {
        recentMonths[key].credits += Number(transaction.amount || 0);
      }

      if (transaction.type === "refund" && transaction.status === "completed") {
        recentMonths[key].refunds += Number(transaction.amount || 0);
      }
    });

    const monthlyBreakdown = Object.values(recentMonths).slice(-6);

    return res.status(200).json({
      message: "Admin reports fetched successfully",
      stats: {
        totalUsers: users.length,
        activeUsers,
        totalOrders: orders.length,
        totalTransactions: transactions.length,
        totalServices: services.length,
        totalTickets: tickets.length,
        totalRevenue,
        totalCredits,
        totalRefunds,
        openTickets,
        reviewTickets,
        resolvedTickets
      },
      topServices,
      monthlyBreakdown
    });
  } catch (error) {
    next(error);
  }
};