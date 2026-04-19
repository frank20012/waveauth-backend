import express from "express";
import {
  getCatalogCountries,
  getCatalogServices
} from "../controllers/catalog.controller.js";

const router = express.Router();

router.get("/countries", getCatalogCountries);
router.get("/services", getCatalogServices);

export default router;