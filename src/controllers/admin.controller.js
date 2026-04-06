import User from "../models/user.js";
import Service from "../models/service.js";
import OtpOrder from "../models/OtpOrder.js";
import Transaction from "../models/transaction.js";
import Ticket from "../models/Ticket.js";

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
        .populate("service")
        .populate("numberInventory")
        .sort({ createdAt: -1 })
        .limit(5),
      Ticket.find()
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.status(200).json({
      message: "Admin overview fetched successfully",
      stats: {
        totalUsers,
        totalServices,
        totalOrders,
        totalTransactions,
        totalTickets
      },
      recentUsers,
      recentOrders,
      recentTickets
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminReports = async (req, res, next) => {
  try {
    const [users, orders, transactions, services, tickets] = await Promise.all([
      User.find().select("-password"),
      OtpOrder.find().populate("service"),
      Transaction.find(),
      Service.find(),
      Ticket.find()
    ]);

    const totalRevenue = transactions
      .filter((t) => t.type === "debit" && t.status === "completed")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalCredits = transactions
      .filter((t) => t.type === "credit" && t.status === "completed")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalRefunds = transactions
      .filter((t) => t.type === "refund" && t.status === "completed")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const activeUsers = users.filter((u) => u.isActive).length;
    const openTickets = tickets.filter((t) => t.status === "open").length;
    const reviewTickets = tickets.filter((t) => t.status === "review").length;
    const resolvedTickets = tickets.filter((t) => t.status === "resolved").length;

    const serviceMap = {};
    orders.forEach((order) => {
      const serviceName = order.service?.name || "Unknown Service";
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
          label: date.toLocaleString("en-US", { month: "long", year: "numeric" }),
          revenue: 0,
          credits: 0,
          refunds: 0,
          transactions: 0
        };
      }

      recentMonths[key].transactions += 1;

      if (transaction.type === "debit" && transaction.status === "completed") {
        recentMonths[key].revenue += Number(transaction.amount);
      }

      if (transaction.type === "credit" && transaction.status === "completed") {
        recentMonths[key].credits += Number(transaction.amount);
      }

      if (transaction.type === "refund" && transaction.status === "completed") {
        recentMonths[key].refunds += Number(transaction.amount);
      }
    });

    const monthlyBreakdown = Object.values(recentMonths).slice(-6);

    res.status(200).json({
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