import axios from "axios";
import Transaction from "../models/transaction.js";
import Wallet from "../models/wallet.js";

const getPaystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
});

const isTerminalFailedStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();
  return ["failed", "abandoned", "cancelled", "canceled", "reversed"].includes(
    normalized
  );
};

const completeWalletFunding = async (transaction, paystackData = {}) => {
  if (transaction.status === "completed") {
    return transaction;
  }

  const wallet = await Wallet.findById(transaction.wallet);

  if (!wallet) {
    throw new Error("Wallet not found for transaction completion");
  }

  wallet.balance += Number(transaction.amount || 0);
  await wallet.save();

  transaction.status = "completed";
  transaction.providerStatus = String(paystackData.status || "success");
  transaction.meta = {
    ...(transaction.meta || {}),
    paidAt: paystackData.paid_at || null,
    channel: paystackData.channel || "",
    gatewayResponse: paystackData.gateway_response || ""
  };

  await transaction.save();
  return transaction;
};

const failWalletFunding = async (
  transaction,
  providerStatus = "failed",
  extra = {}
) => {
  transaction.status = "failed";
  transaction.providerStatus = String(providerStatus || "failed");
  transaction.meta = {
    ...(transaction.meta || {}),
    ...extra
  };

  await transaction.save();
  return transaction;
};

const reconcilePendingPaystackTransaction = async (transaction) => {
  if (!transaction?.reference) {
    return transaction;
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${transaction.reference}`,
      {
        headers: getPaystackHeaders()
      }
    );

    const paystackData = response.data?.data;

    if (!paystackData) {
      return failWalletFunding(transaction, "invalid_verify_response", {
        reconcileError: "Paystack returned empty verification response"
      });
    }

    const providerStatus = String(paystackData.status || "").toLowerCase();

    if (providerStatus === "success") {
      return completeWalletFunding(transaction, paystackData);
    }

    if (isTerminalFailedStatus(providerStatus) || providerStatus !== "success") {
      return failWalletFunding(transaction, providerStatus, {
        paidAt: paystackData.paid_at || null,
        channel: paystackData.channel || "",
        gatewayResponse: paystackData.gateway_response || ""
      });
    }

    return transaction;
  } catch (error) {
    const statusCode = error.response?.status;

    if (statusCode === 400 || statusCode === 404) {
      return failWalletFunding(transaction, "invalid_reference", {
        reconcileError: error.message || "Paystack verify failed",
        paystackStatusCode: statusCode
      });
    }

    throw error;
  }
};

const reconcileUserPendingFundingTransactions = async (userId) => {
  const pendingTransactions = await Transaction.find({
    user: userId,
    type: "credit",
    paymentProvider: "paystack",
    status: "pending"
  }).sort({ createdAt: -1 });

  for (const transaction of pendingTransactions) {
    try {
      await reconcilePendingPaystackTransaction(transaction);
    } catch (error) {
      console.log(
        `Pending Paystack reconcile failed for ${transaction.reference}:`,
        error.message
      );
    }
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    await reconcileUserPendingFundingTransactions(req.user._id);

    const transactions = await Transaction.find({ user: req.user._id }).sort({
      createdAt: -1
    });

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