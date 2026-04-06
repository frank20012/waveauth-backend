import express from "express";
import {
  createNumber,
  getAllNumbers,
  getAvailableNumbers
} from "../controllers/numberInventory.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";

const router = express.Router();

router.get("/available", protect, adminOnly, getAvailableNumbers);
router.get("/", protect, adminOnly, getAllNumbers);
router.post("/", protect, adminOnly, createNumber);

export default router;