import express from "express";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";
import {
  getAllTransactionsForAdmin,
  getTransactions,
  getAdminTransactions
} from "../controllers/transaction.controller.js";

const router = express.Router();

router.get("/", protect, getTransactions);
router.get("/admin/all", protect, adminOnly, getAllTransactionsForAdmin);
router.get("/admin", protect, adminOnly, getAdminTransactions);

export default router;