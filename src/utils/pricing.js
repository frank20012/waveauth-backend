import axios from "axios";

const FLAT_MARKUP_NAIRA = Number(process.env.FLAT_MARKUP_NAIRA || 1800);
const PERCENTAGE_MARKUP = Number(process.env.PERCENTAGE_MARKUP || 0);

const FALLBACK_RATES = {
  USD_NGN: Number(process.env.USD_TO_NGN || 1500),
  RUB_NGN: Number(process.env.RUB_TO_NGN || 16)
};

let cachedRates = {
  USD_NGN: FALLBACK_RATES.USD_NGN,
  RUB_NGN: FALLBACK_RATES.RUB_NGN
};

let lastFetchedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export const getExchangeRates = async () => {
  const now = Date.now();

  if (now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedRates;
  }

  try {
    const [usdResponse, rubResponse] = await Promise.all([
      axios.get("https://api.frankfurter.dev/v2/rates?base=USD&symbols=NGN", {
        timeout: 10000
      }),
      axios.get("https://api.frankfurter.dev/v2/rates?base=RUB&symbols=NGN", {
        timeout: 10000
      })
    ]);

    const usdRate =
      usdResponse?.data?.rates?.NGN ??
      usdResponse?.data?.data?.rates?.NGN ??
      null;

    const rubRate =
      rubResponse?.data?.rates?.NGN ??
      rubResponse?.data?.data?.rates?.NGN ??
      null;

    if (usdRate && Number(usdRate) > 0) {
      cachedRates.USD_NGN = Number(usdRate);
    }

    if (rubRate && Number(rubRate) > 0) {
      cachedRates.RUB_NGN = Number(rubRate);
    }

    lastFetchedAt = now;
    return cachedRates;
  } catch (error) {
    console.log("Using fallback exchange rates:", cachedRates);
    return cachedRates;
  }
};

export const convertProviderPriceToNgn = async (
  amount,
  currency = "USD"
) => {
  const numericAmount = Number(amount || 0);
  const normalizedCurrency = String(currency || "USD").trim().toUpperCase();

  if (!numericAmount) return 0;

  const rates = await getExchangeRates();

  if (normalizedCurrency === "USD") {
    return Math.ceil(numericAmount * rates.USD_NGN);
  }

  if (normalizedCurrency === "RUB") {
    return Math.ceil(numericAmount * rates.RUB_NGN);
  }

  if (normalizedCurrency === "NGN") {
    return Math.ceil(numericAmount);
  }

  return Math.ceil(numericAmount * rates.USD_NGN);
};

export const calculateSellingPriceNaira = async (
  providerPrice,
  providerCurrency = "USD"
) => {
  const providerCostNaira = await convertProviderPriceToNgn(
    providerPrice,
    providerCurrency
  );

  const percentageMarkupAmount =
    (providerCostNaira * PERCENTAGE_MARKUP) / 100;

  const sellingPrice =
    providerCostNaira + percentageMarkupAmount + FLAT_MARKUP_NAIRA;

  return Math.ceil(sellingPrice);
};

export const getMarkupNaira = () => FLAT_MARKUP_NAIRA;
export const getPercentageMarkup = () => PERCENTAGE_MARKUP;