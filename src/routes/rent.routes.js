import express from "express";
import protect from "../middlewares/auth.middleware.js";
import {
  getRentCountries,
  getRentServices,
  createRentOrder,
  getMyRentOrders,
  checkRentOrderStatus,
  cancelRentOrder
} from "../controllers/rent.controller.js";

const router = express.Router();

router.get("/countries", protect, getRentCountries);
router.get("/services", protect, getRentServices);
router.post("/buy", protect, createRentOrder);
router.get("/orders", protect, getMyRentOrders);
router.get("/orders/:id/status", protect, checkRentOrderStatus);
router.patch("/orders/:id/cancel", protect, cancelRentOrder);

export default router;