import express from "express";
import protect from "../middlewares/auth.middleware.js";
import { fundWallet, getWallet } from "../controllers/wallet.controller.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.post("/fund", protect, fundWallet);

export default router;