import axios from "axios";
import crypto from "crypto";
import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";

const generateReference = () => {
  return `PSK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

export const initializePaystackPayment = async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      res.status(400);
      throw new Error("Valid amount is required");
    }

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      res.status(404);
      throw new Error("Wallet not found");
    }

    const parsedAmount = Number(amount);
    const reference = generateReference();

    await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: "credit",
      amount: parsedAmount,
      description: "Wallet funding via Paystack",
      status: "pending",
      reference
    });

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
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const paystackData = response.data?.data;

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
      throw new Error("Pending transaction not found");
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

    if (paystackData.status !== "success") {
      transaction.status = "failed";
      await transaction.save();

      res.status(400);
      throw new Error("Payment was not successful");
    }

    const wallet = await Wallet.findById(transaction.wallet);

    if (!wallet) {
      res.status(404);
      throw new Error("Wallet not found");
    }

    wallet.balance += transaction.amount;
    await wallet.save();

    transaction.status = "completed";
    await transaction.save();

    res.status(200).json({
      message: "Payment verified and wallet funded successfully",
      wallet,
      transaction
    });
  } catch (error) {
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

    if (event.event === "charge.success") {
      const data = event.data;
      const reference = data.reference;

      const transaction = await Transaction.findOne({ reference });

      if (!transaction) {
        return res.sendStatus(200);
      }

      if (transaction.status === "completed") {
        return res.sendStatus(200);
      }

      const wallet = await Wallet.findById(transaction.wallet);

      if (!wallet) {
        return res.sendStatus(200);
      }

      wallet.balance += transaction.amount;
      await wallet.save();

      transaction.status = "completed";
      await transaction.save();
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
};