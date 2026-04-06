import express from "express";
import protect from "../middlewares/auth.middleware.js";
import {
  handlePaystackWebhook,
  initializePaystackPayment,
  verifyPaystackPayment
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/paystack/initialize", protect, initializePaystackPayment);
router.get("/paystack/verify/:reference", protect, verifyPaystackPayment);
router.post("/paystack/webhook", handlePaystackWebhook);

export default router;