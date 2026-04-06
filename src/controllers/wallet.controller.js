import Wallet from "../models/wallet.js";
import Transaction from "../models/transaction.js";

const generateReference = () => {
  return `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

export const getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      res.status(404);
      throw new Error("Wallet not found");
    }

    res.status(200).json({
      message: "Wallet fetched successfully",
      wallet
    });
  } catch (error) {
    next(error);
  }
};

export const fundWallet = async (req, res, next) => {
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

    wallet.balance += Number(amount);
    await wallet.save();

    const transaction = await Transaction.create({
      user: req.user._id,
      wallet: wallet._id,
      type: "credit",
      amount: Number(amount),
      description: "Wallet funding",
      status: "completed",
      reference: generateReference()
    });

    res.status(200).json({
      message: "Wallet funded successfully",
      wallet,
      transaction
    });
  } catch (error) {
    next(error);
  }
};