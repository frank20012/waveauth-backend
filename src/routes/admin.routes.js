import express from "express";
import {
  getAdminOverview,
  getAdminReports,
  getAdminOrders,
  updateAdminOrder,
  getAdminServices,
  createAdminService
} from "../controllers/admin.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";

const router = express.Router();

router.get("/", protect, adminOnly, getAdminOverview);
router.get("/reports", protect, adminOnly, getAdminReports);

router.get("/orders", protect, adminOnly, getAdminOrders);
router.patch("/orders/:id", protect, adminOnly, updateAdminOrder);

router.get("/services", protect, adminOnly, getAdminServices);
router.post("/services", protect, adminOnly, createAdminService);

export default router;