import {
  getMergedCountries,
  getMergedServicesByCountry
} from "../services/mergedCatalog.service.js";

export const getCatalogCountries = async (req, res) => {
  try {
    const countries = await getMergedCountries();

    return res.status(200).json({
      success: true,
      countries
    });
  } catch (error) {
    console.error("CATALOG COUNTRIES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch merged countries",
      error: error.message
    });
  }
};

export const getCatalogServices = async (req, res) => {
  try {
    const { country } = req.query;

    if (!country) {
      return res.status(400).json({
        success: false,
        message: "Country is required"
      });
    }

    const services = await getMergedServicesByCountry({ country });

    return res.status(200).json({
      success: true,
      country: String(country).trim().toUpperCase(),
      services
    });
  } catch (error) {
    console.error("CATALOG SERVICES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch merged services",
      error: error.message
    });
  }
};