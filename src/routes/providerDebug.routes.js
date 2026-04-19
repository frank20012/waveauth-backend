import express from "express";
import protect from "../middlewares/auth.middleware.js";
import adminOnly from "../middlewares/admin.middleware.js";
import {
  getProviderCountries,
  getProviderServices,
  getProviderBalance
} from "../controllers/providerDebug.controller.js";

const router = express.Router();

router.get("/:provider/countries", protect, adminOnly, getProviderCountries);
router.get("/:provider/services", protect, adminOnly, getProviderServices);
router.get("/:provider/balance", protect, adminOnly, getProviderBalance);

export default router;