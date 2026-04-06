import express from "express";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";
import {
  cancelOtpOrder,
  createOtpOrder,
  getAllOtpOrdersForAdmin,
  getMyOtpOrders,
  getSingleOtpOrder,
  updateOtpOrderStatusByAdmin,
  getAdminOrders
} from "../controllers/otpOrder.controller.js";

const router = express.Router();

router.post("/", protect, createOtpOrder);
router.get("/", protect, getMyOtpOrders);
router.get("/admin/all", protect, adminOnly, getAllOtpOrdersForAdmin);
router.get("/admin", protect, adminOnly, getAdminOrders);
router.patch("/admin/:id", protect, adminOnly, updateOtpOrderStatusByAdmin);
router.get("/:id", protect, getSingleOtpOrder);
router.patch("/:id/cancel", protect, cancelOtpOrder);

export default router;