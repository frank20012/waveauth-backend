import { getAllProviders } from "./providerRegistry.js";
import {
  calculateSellingPriceNaira,
  convertProviderPriceToNgn
} from "../utils/pricing.js";

export const getUnifiedServicePricing = async ({
  country,
  service,
  type = "temporary"
}) => {
  const providers = getAllProviders();

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const priceData = await provider.getPrice({ country, service, type });

      const providerPrice = Number(priceData?.providerPrice || 0);
      const providerCurrency = String(
        priceData?.providerCurrency || "USD"
      ).toUpperCase();
      const stock = Number(priceData?.stock || 0);
      const hasValidPrice = providerPrice > 0;

      return {
        provider: provider.name,
        country,
        service,
        type,
        providerPrice,
        providerCurrency,
        stock,
        hasValidPrice,
        basePriceNgn: hasValidPrice
          ? await convertProviderPriceToNgn(providerPrice, providerCurrency)
          : 0,
        sellingPriceNgn: hasValidPrice
          ? await calculateSellingPriceNaira(providerPrice, providerCurrency)
          : 0,
        raw: priceData?.raw || null
      };
    })
  );

  const normalizedResults = results.map((result, index) => {
    const provider = providers[index];

    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider: provider.name,
      country,
      service,
      type,
      providerPrice: 0,
      providerCurrency: "USD",
      stock: 0,
      hasValidPrice: false,
      basePriceNgn: 0,
      sellingPriceNgn: 0,
      raw: null,
      error: result.reason?.message || "Failed to fetch provider pricing"
    };
  });

  return normalizedResults.sort((a, b) => {
    const aAvailable = Number(a.stock || 0) > 0;
    const bAvailable = Number(b.stock || 0) > 0;

    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    const aPriced = Boolean(a.hasValidPrice);
    const bPriced = Boolean(b.hasValidPrice);

    if (aPriced && !bPriced) return -1;
    if (!aPriced && bPriced) return 1;

    return Number(a.sellingPriceNgn || 0) - Number(b.sellingPriceNgn || 0);
  });
};

export const getBestProviderForService = async ({
  country,
  service,
  type = "temporary"
}) => {
  const pricing = await getUnifiedServicePricing({
    country,
    service,
    type
  });

  return (
    pricing.find(
      (item) =>
        !item.error &&
        Number(item.stock || 0) > 0 &&
        Boolean(item.hasValidPrice)
    ) || null
  );
};