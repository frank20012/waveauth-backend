import express from "express";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";
import {
  getAllUsersForAdmin,
  getMyProfile,
  getUsers,
  updateMyProfile,
  getAllUsers
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/", getUsers);
router.get("/me", protect, getMyProfile);
router.patch("/me", protect, updateMyProfile);
router.get("/admin/all", protect, adminOnly, getAllUsersForAdmin);
router.get("/", protect, adminOnly, getAllUsers);

export default router;