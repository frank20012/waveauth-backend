import { getUnifiedServicePricing } from "../services/catalog.service.js";

export const getServices = async (req, res) => {
  try {
    const { country, service, type } = req.query;

    if (!country) {
      return res.status(200).json({
        success: true,
        type: "countries",
        message:
          "Country list is no longer coming from FiveSim. Use the merged catalog endpoint instead.",
        data: []
      });
    }

    const normalizedCountry = String(country).trim().toUpperCase();

    if (!service) {
      return res.status(200).json({
        success: true,
        type: "services",
        country: normalizedCountry,
        message:
          "Service name is required to compare provider pricing across SMSPool, Tiger, and PVAPins.",
        services: []
      });
    }

    const normalizedService = String(service).trim().toLowerCase();
    const normalizedType =
      String(type || "temporary").trim().toLowerCase() === "rental"
        ? "rental"
        : "temporary";

    const providerResults = await getUnifiedServicePricing({
      country: normalizedCountry,
      service: normalizedService,
      type: normalizedType
    });

    const pricedAvailableProviders = providerResults.filter(
      (item) =>
        !item.error &&
        Number(item.stock || 0) > 0 &&
        Boolean(item.hasValidPrice)
    );

    const cheapestProvider =
      pricedAvailableProviders.length > 0 ? pricedAvailableProviders[0] : null;

    const services = providerResults.map((item) => ({
      provider: item.provider,
      name: normalizedService,
      country: normalizedCountry,
      type: normalizedType,
      price: Boolean(item.hasValidPrice)
        ? Number(item.sellingPriceNgn || 0)
        : null,
      currency: "NGN",
      available: Number(item.stock || 0) > 0,
      count: Number(item.stock || 0),
      status: Number(item.stock || 0) > 0 ? "active" : "inactive",
      hasValidPrice: Boolean(item.hasValidPrice),
      error: item.error || null,
      stockMode: item.raw?.stockMode || null
    }));

    return res.status(200).json({
      success: true,
      type: "services",
      country: normalizedCountry,
      service: normalizedService,
      serviceType: normalizedType,
      cheapestProvider,
      providers: providerResults,
      services
    });
  } catch (error) {
    console.error("SERVICE FETCH ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services from providers",
      error: error.message
    });
  }
};