import axios from "axios";

const MARKUP_NAIRA = 800;
const FALLBACK_USD_TO_NGN = 1500;

let cachedRate = FALLBACK_USD_TO_NGN;
let lastFetchedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

export const getUsdToNgnRate = async () => {
  const now = Date.now();

  if (now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const response = await axios.get(
      "https://api.frankfurter.dev/v2/rates?base=USD&quotes=NGN"
    );

    const data = response.data;

    const rate =
      data?.rates?.NGN ??
      data?.data?.rates?.NGN ??
      (Array.isArray(data) ? data[0]?.rate : null);

    if (!rate || Number(rate) <= 0) {
      throw new Error("Invalid exchange rate response");
    }

    cachedRate = Number(rate);
    lastFetchedAt = now;

    return cachedRate;
  } catch (error) {
    console.log("Using fallback USD/NGN rate:", cachedRate);
    return cachedRate;
  }
};

export const calculateSellingPriceNaira = (providerPriceUsd, usdToNgnRate) => {
  const providerCostNaira = Number(providerPriceUsd || 0) * Number(usdToNgnRate || 0);
  const sellingPrice = providerCostNaira + MARKUP_NAIRA;

  return Math.ceil(sellingPrice);
};

export const getMarkupNaira = () => MARKUP_NAIRA;