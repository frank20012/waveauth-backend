import express from "express";
import protect from "../middlewares/auth.middleware.js";
import {
  buyOtpNumber,
  getMyOtpOrders,
  checkOtpOrderStatus,
  cancelOtpOrder
} from "../controllers/otp.controller.js";

const router = express.Router();

router.get("/", protect, getMyOtpOrders);
router.post("/buy", protect, buyOtpNumber);
router.get("/:id/status", protect, checkOtpOrderStatus);
router.patch("/:id/cancel", protect, cancelOtpOrder);

export default router;