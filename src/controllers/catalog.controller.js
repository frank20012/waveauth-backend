import {
  getUnifiedCountries,
  getUnifiedServicesByCountry
} from "../services/catalog.service.js";

export const getCatalogCountries = async (req, res) => {
  try {
    const countries = await getUnifiedCountries();

    return res.status(200).json({
      success: true,
      count: countries.length,
      countries
    });
  } catch (error) {
    console.error("CATALOG COUNTRIES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load country catalog",
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
        message: "country is required"
      });
    }

    const services = await getUnifiedServicesByCountry(country);

    return res.status(200).json({
      success: true,
      country,
      count: services.length,
      services
    });
  } catch (error) {
    console.error("CATALOG SERVICES ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load service catalog",
      error: error.message
    });
  }
};