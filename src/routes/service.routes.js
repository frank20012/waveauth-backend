import express from "express";
import {
  createService,
  getAllServicesForAdmin,
  getServices
} from "../controllers/service.controller.js";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";

const router = express.Router();

router.get("/", getServices);
router.get("/admin/all", protect, adminOnly, getAllServicesForAdmin);
router.post("/", protect, adminOnly, createService);

export default router;