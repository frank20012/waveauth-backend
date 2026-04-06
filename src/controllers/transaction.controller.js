import Transaction from "../models/transaction.js";

export const getTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Transactions fetched successfully",
      count: transactions.length,
      transactions
    });
  } catch (error) {
    next(error);
  }
};
export const getAdminTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find()
      .populate("user", "email firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      transactions
    });
  } catch (error) {
    next(error);
  }
};
export const getAllTransactionsForAdmin = async (req, res, next) => {
  try {
    const transactions = await Transaction.find()
      .populate("user", "firstName lastName email")
      .populate("wallet")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Admin transactions fetched successfully",
      count: transactions.length,
      transactions
    });
  } catch (error) {
    next(error);
  }
};