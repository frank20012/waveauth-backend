import express from "express";
import protect from "../middlewares/auth.middleware.js";
import {
  handlePaystackWebhook,
  initializePaystackPayment,
  verifyPaystackPayment,
  initializeEtegramPayment,
  verifyEtegramPayment,
  handleEtegramWebhook
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/paystack/initialize", protect, initializePaystackPayment);
router.get("/paystack/verify/:reference", protect, verifyPaystackPayment);
router.post("/paystack/webhook", handlePaystackWebhook);

router.post("/etegram/initialize", protect, initializeEtegramPayment);
router.get("/etegram/verify/:reference/:accessCode", protect, verifyEtegramPayment);
router.post("/etegram/webhook", handleEtegramWebhook);

export default router;