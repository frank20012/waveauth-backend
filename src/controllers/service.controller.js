import { getCountries, getPricesByCountry } from "../services/fivesim.service.js";
import { getUsdToNgnRate, calculateSellingPriceNaira } from "../utils/pricing.js";

const getCheapestProviderPrice = (operators = {}) => {
  let cheapestPrice = null;
  let totalCount = 0;

  Object.values(operators).forEach((operatorData) => {
    const cost = Number(operatorData?.cost || 0);
    const count = Number(operatorData?.count || 0);

    totalCount += count;

    if (cheapestPrice === null || cost < cheapestPrice) {
      cheapestPrice = cost;
    }
  });

  return {
    cheapestPrice: cheapestPrice ?? 0,
    totalCount
  };
};

export const getServices = async (req, res) => {
  try {
    const { country } = req.query;

    if (!country) {
      const countries = await getCountries();

      return res.status(200).json({
        type: "countries",
        data: Object.keys(countries)
      });
    }

    const normalizedCountry = String(country).trim().toLowerCase();
    const providerData = await getPricesByCountry(normalizedCountry);
    const countryData = providerData?.[normalizedCountry] || {};
    const usdToNgnRate = await getUsdToNgnRate();

    const services = Object.entries(countryData).map(([serviceName, operators]) => {
      const { cheapestPrice, totalCount } = getCheapestProviderPrice(operators);

      return {
        name: serviceName,
        country: normalizedCountry,
        providerPriceUsd: cheapestPrice,
        price: calculateSellingPriceNaira(cheapestPrice, usdToNgnRate),
        currency: "NGN",
        available: totalCount > 0,
        count: totalCount,
        status: totalCount > 0 ? "active" : "inactive"
      };
    });

    return res.status(200).json({
      type: "services",
      exchangeRate: usdToNgnRate,
      services
    });
  } catch (error) {
    console.error("SERVICE FETCH ERROR:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Failed to fetch services from provider"
    });
  }
};