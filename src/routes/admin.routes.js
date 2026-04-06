import express from "express";
import {
  getAdminOverview,
  getAdminReports
} from "../controllers/admin.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";

const router = express.Router();

router.get("/", protect, adminOnly, getAdminOverview);
router.get("/reports", protect, adminOnly, getAdminReports);

export default router;