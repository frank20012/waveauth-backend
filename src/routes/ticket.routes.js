import express from "express";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";
import {
  createTicket,
  getMyTickets,
  getAllTickets,
  updateTicket
} from "../controllers/ticket.controller.js";

const router = express.Router();

router.post("/", protect, createTicket);
router.get("/me", protect, getMyTickets);

router.get("/", protect, adminOnly, getAllTickets);
router.put("/:id", protect, adminOnly, updateTicket);

export default router;