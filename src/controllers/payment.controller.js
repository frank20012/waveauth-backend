import axios from "axios";
import crypto from "crypto";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";

const MIN_FUND_AMOUNT = 100;
const MAX_FUND_AMOUNT = 1000000;

const generateReference = (prefix = "PSK") => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

const getPaystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json"
});

const getEtegramHeaders = () => ({
  Authorization: `Bearer ${process.env.ETEGRAM_PUBLIC_KEY}`,
  "Content-Type": "application/json"
});

const isTerminalFailedStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();
  return ["failed", "abandoned", "cancelled", "canceled", "reversed"].includes(
    normalized
  );
};

const saveFailedTransaction = async (
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

const completeWalletFunding = async (
  transaction,
  providerStatus = "success",
  extra = {}
) => {
  if (transaction.status === "completed") {
    return transaction;
  }

  const wallet = await Wallet.findById(transaction.wallet);

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  wallet.balance += Number(transaction.amount || 0);
  await wallet.save();

  transaction.status = "completed";
  transaction.providerStatus = String(providerStatus || "success");
  transaction.meta = {
    ...(transaction.meta || {}),
    ...extra
  };
  await transaction.save();

  return transaction;
};

const validateFundingInput = async (req, res) => {
  const { amount } = req.body;
  const parsedAmount = Number(amount);

  if (!parsedAmount || Number.isNaN(parsedAmount)) {
    res.status(400);
    throw new Error("Valid amount is required");
  }

  if (parsedAmount < MIN_FUND_AMOUNT) {
    res.status(400);
    throw new Error(`Minimum funding amount is ₦${MIN_FUND_AMOUNT}`);
  }

  if (parsedAmount > MAX_FUND_AMOUNT) {
    res.status(400);
    throw new Error(`Maximum funding amount is ₦${MAX_FUND_AMOUNT.toLocaleString()}`);
  }

  const wallet = await Wallet.findOne({ user: req.user._id });

  if (!wallet) {
    res.status(404);
    throw new Error("Wallet not found");
  }

  return {
    parsedAmount,
    wallet
  };
};

export const initializePaystackPayment = async (req, res, next) => {
  try {
    const { parsedAmount, wallet } = await validateFundingInput(req, res);
    const reference = generateReference("PSK");

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: req.user.email,
        amount: Math.round(parsedAmount * 100),
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          userId: req.user._id.toString(),
          walletId: wallet._id.toString(),
          fundingType: "wallet"
        }
      },
      {
        headers: getPaystackHeaders()
      }
    );

    const paystackData = response.data?.data;

    if (!paystackData?.authorization_url) {
      res.status(400);
      throw new Error("Paystack did not return an authorization URL");
    }

    await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: "credit",
      amount: parsedAmount,
      description: "Fund Wallet",
      status: "pending",
      reference,
      paymentProvider: "paystack",
      providerStatus: "pending_payment",
      meta: {
        fundingType: "wallet",
        accessCode: paystackData.access_code || ""
      }
    });

    res.status(200).json({
      message: "Payment initialized successfully",
      authorization_url: paystackData.authorization_url,
      access_code: paystackData.access_code,
      reference: paystackData.reference
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPaystackPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      res.status(400);
      throw new Error("Transaction reference is required");
    }

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      res.status(404);
      throw new Error("Transaction not found");
    }

    if (transaction.status === "completed") {
      const wallet = await Wallet.findById(transaction.wallet);

      return res.status(200).json({
        message: "Payment already verified",
        wallet,
        transaction
      });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const paystackData = response.data?.data;

    if (!paystackData) {
      res.status(400);
      throw new Error("Invalid Paystack verification response");
    }

    const providerStatus = String(paystackData.status || "").toLowerCase();

    if (providerStatus === "success") {
      const completedTransaction = await completeWalletFunding(
        transaction,
        providerStatus,
        {
          paidAt: paystackData.paid_at || null,
          channel: paystackData.channel || "",
          gatewayResponse: paystackData.gateway_response || ""
        }
      );

      const wallet = await Wallet.findById(completedTransaction.wallet);

      return res.status(200).json({
        message: "Payment verified and wallet funded successfully",
        wallet,
        transaction: completedTransaction
      });
    }

    if (isTerminalFailedStatus(providerStatus) || providerStatus !== "success") {
      await saveFailedTransaction(transaction, providerStatus, {
        gatewayResponse: paystackData.gateway_response || "",
        paidAt: paystackData.paid_at || null
      });

      res.status(400);
      throw new Error("Payment was not successful");
    }
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      const { reference } = req.params;

      const transaction = await Transaction.findOne({ reference });

      if (transaction && transaction.status === "pending") {
        await saveFailedTransaction(transaction, "invalid_reference", {
          reconcileError: error.message || "Paystack verify failed",
          paystackStatusCode: error.response?.status || null
        });
      }

      res.status(400);
      return next(new Error("Invalid Paystack transaction reference"));
    }

    next(error);
  }
};

export const handlePaystackWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!signature || !secretKey) {
      return res.sendStatus(400);
    }

    const hash = crypto
      .createHmac("sha512", secretKey)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      return res.sendStatus(401);
    }

    const event = req.body;
    const eventData = event?.data || {};
    const reference = eventData.reference;

    if (!reference) {
      return res.sendStatus(200);
    }

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      return res.sendStatus(200);
    }

    if (event.event === "charge.success") {
      await completeWalletFunding(transaction, "success", {
        paidAt: eventData.paid_at || null,
        channel: eventData.channel || "",
        gatewayResponse: eventData.gateway_response || ""
      });

      return res.sendStatus(200);
    }

    if (event.event === "charge.failed") {
      await saveFailedTransaction(transaction, "failed", {
        gatewayResponse: eventData.gateway_response || ""
      });

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};

export const initializeEtegramPayment = async (req, res, next) => {
  try {
    const { parsedAmount, wallet } = await validateFundingInput(req, res);

    if (!process.env.ETEGRAM_PROJECT_ID) {
      res.status(500);
      throw new Error("ETEGRAM_PROJECT_ID is missing");
    }

    if (!process.env.ETEGRAM_PUBLIC_KEY) {
      res.status(500);
      throw new Error("ETEGRAM_PUBLIC_KEY is missing");
    }

    const reference = generateReference("ETG");
    const baseUrl =
      process.env.ETEGRAM_BASE_URL || "https://api-checkout.etegram.com";

    const response = await axios.post(
      `${baseUrl}/api/transaction/initialize/${process.env.ETEGRAM_PROJECT_ID}`,
      {
        amount: parsedAmount,
        email: req.user.email,
        phone: req.user.phone || "00000000000",
        firstname: req.user.firstName || "Desk",
        lastname: req.user.lastName || "User",
        reference
      },
      {
        headers: getEtegramHeaders()
      }
    );

    console.log("ETEGRAM INIT RESPONSE:", response.data);

    const etegramData = response.data?.data;

    if (!etegramData?.authorization_url || !etegramData?.access_code) {
      res.status(400);
      throw new Error("Etegram did not return a valid authorization URL");
    }

    await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: "credit",
      amount: parsedAmount,
      description: "Fund Wallet",
      status: "pending",
      reference: etegramData.reference || reference,
      paymentProvider: "etegram",
      providerStatus: "pending_payment",
      meta: {
        fundingType: "wallet",
        accessCode: etegramData.access_code || "",
        gateway: "etegram"
      }
    });

    res.status(200).json({
      message: "Etegram payment initialized successfully",
      authorization_url: etegramData.authorization_url,
      access_code: etegramData.access_code,
      reference: etegramData.reference || reference
    });
  } catch (error) {
    console.log("ETEGRAM INIT ERROR:", error.response?.data || error.message);
    next(error);
  }
};

export const verifyEtegramPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      res.status(400);
      throw new Error("Transaction reference is required");
    }

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      res.status(404);
      throw new Error("Transaction not found");
    }

    if (transaction.status === "completed") {
      const wallet = await Wallet.findById(transaction.wallet);

      return res.status(200).json({
        message: "Payment already verified",
        wallet,
        transaction
      });
    }

    if (!process.env.ETEGRAM_PROJECT_ID) {
      res.status(500);
      throw new Error("ETEGRAM_PROJECT_ID is missing");
    }

    const accessCode = transaction.meta?.accessCode;

    if (!accessCode) {
      await saveFailedTransaction(transaction, "missing_access_code", {
        reconcileError: "Stored Etegram access code was not found"
      });

      res.status(400);
      throw new Error("Etegram access code not found for this transaction");
    }

    const baseUrl =
      process.env.ETEGRAM_VERIFY_BASE_URL ||
      process.env.ETEGRAM_BASE_URL ||
      "https://api-checkout.etegram.com.com";

    const response = await axios.patch(
      `${baseUrl}/api/transaction/verify-payment/${process.env.ETEGRAM_PROJECT_ID}/${accessCode}`
    );

    console.log("ETEGRAM VERIFY RESPONSE:", response.data);

    const etegramData = response.data?.data || response.data || {};
    const providerStatus = String(
      etegramData.status || etegramData.paymentStatus || ""
    ).toLowerCase();

    if (providerStatus === "success" || providerStatus === "successful") {
      const completedTransaction = await completeWalletFunding(
        transaction,
        providerStatus,
        {
          paidAt: etegramData.paid_at || etegramData.paidAt || null,
          channel: etegramData.channel || "",
          gatewayResponse: etegramData.message || "Verified by Etegram",
          accessCode
        }
      );

      const wallet = await Wallet.findById(completedTransaction.wallet);

      return res.status(200).json({
        message: "Payment verified and wallet funded successfully",
        wallet,
        transaction: completedTransaction
      });
    }

    await saveFailedTransaction(transaction, providerStatus || "failed", {
      gatewayResponse: etegramData.message || "Etegram payment was not successful",
      accessCode
    });

    res.status(400);
    throw new Error("Payment was not successful");
  } catch (error) {
    console.log("ETEGRAM VERIFY ERROR:", error.response?.data || error.message);

    if (error.response?.status === 400 || error.response?.status === 404) {
      const { reference } = req.params;
      const transaction = await Transaction.findOne({ reference });

      if (transaction && transaction.status === "pending") {
        await saveFailedTransaction(transaction, "invalid_reference", {
          reconcileError: error.message || "Etegram verify failed",
          etegramStatusCode: error.response?.status || null
        });
      }

      res.status(400);
      return next(new Error("Invalid Etegram transaction reference"));
    }

    next(error);
  }
};

export const handleEtegramWebhook = async (req, res, next) => {
  try {
    const eventData = req.body || {};
    const reference = eventData.reference;

    if (!reference) {
      return res.sendStatus(200);
    }

    const transaction = await Transaction.findOne({ reference });

    if (!transaction) {
      return res.sendStatus(200);
    }

    const providerStatus = String(eventData.status || "").toLowerCase();

    if (providerStatus === "success" || providerStatus === "successful") {
      await completeWalletFunding(transaction, providerStatus, {
        paidAt: eventData.paid_at || eventData.paidAt || null,
        channel: eventData.channel || "",
        gatewayResponse: eventData.message || "Webhook success"
      });

      return res.sendStatus(200);
    }

    if (isTerminalFailedStatus(providerStatus) || providerStatus) {
      await saveFailedTransaction(transaction, providerStatus, {
        gatewayResponse: eventData.message || ""
      });

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};