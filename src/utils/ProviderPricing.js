const normalizeText = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "");

const DEFAULT_MARKUP_NGN = Number(process.env.DEFAULT_MARKUP_NGN || 800);

// Your controlled selling prices in NGN.
// Edit this table anytime you want to change prices.
const PRICE_TABLE_NGN = {
  usa: {
    whatsapp: 2800,
    telegram: 2000,
    facebook: 2300,
    instagram: 2200,
    gmail: 1800,
    google: 1800,
    tiktok: 2100,
    twitter: 1900,
    uber: 2500,
    amazon: 2400,
    paypal: 3000
  },
  uk: {
    whatsapp: 3200,
    telegram: 2400,
    facebook: 2600,
    instagram: 2500,
    gmail: 2100,
    google: 2100,
    tiktok: 2300,
    twitter: 2200,
    uber: 2900,
    amazon: 2800,
    paypal: 3400
  },
  nigeria: {
    whatsapp: 1800,
    telegram: 1500,
    facebook: 1700,
    instagram: 1700,
    gmail: 1400,
    google: 1400,
    tiktok: 1600,
    twitter: 1500
  }
};

// Tiger maxPrice is documented in rubles on the public API page.
// Since you may not have a reliable live quote endpoint, keep this conservative.
// You can tune these manually later.
const PROVIDER_MAX_PRICE_TABLE = {
  usa: {
    whatsapp: 40,
    telegram: 35,
    facebook: 35,
    instagram: 35,
    gmail: 30,
    google: 30,
    tiktok: 35,
    twitter: 30,
    uber: 45,
    amazon: 45,
    paypal: 55
  },
  uk: {
    whatsapp: 45,
    telegram: 40,
    facebook: 40,
    instagram: 40,
    gmail: 35,
    google: 35,
    tiktok: 38,
    twitter: 35,
    uber: 48,
    amazon: 48,
    paypal: 60
  },
  nigeria: {
    whatsapp: 30,
    telegram: 25,
    facebook: 25,
    instagram: 25,
    gmail: 20,
    google: 20,
    tiktok: 24,
    twitter: 22
  }
};

export const getOrderSellingPriceNgn = ({ country, serviceName }) => {
  const normalizedCountry = normalizeText(country);
  const normalizedService = normalizeText(serviceName);

  const countryPricing = PRICE_TABLE_NGN[normalizedCountry];

  if (countryPricing?.[normalizedService]) {
    return Number(countryPricing[normalizedService]);
  }

  return DEFAULT_MARKUP_NGN;
};

export const getTigerMaxPrice = ({ country, serviceName }) => {
  const normalizedCountry = normalizeText(country);
  const normalizedService = normalizeText(serviceName);

  const countryPricing = PROVIDER_MAX_PRICE_TABLE[normalizedCountry];

  if (countryPricing?.[normalizedService]) {
    return Number(countryPricing[normalizedService]);
  }

  return undefined;
};

export const normalizeCountryCodeForTiger = (country) => {
  const normalized = normalizeText(country);

  const map = {
    usa: "usa",
    unitedstates: "usa",
    uk: "uk",
    unitedkingdom: "uk",
    nigeria: "nigeria",
    india: "india",
    canada: "canada",
    germany: "germany",
    france: "france"
  };

  return map[normalized] || normalized;
};

export const normalizeServiceCodeForTiger = (serviceName) => {
  const normalized = normalizeText(serviceName);

  const map = {
    whatsapp: "wa",
    telegram: "tg",
    facebook: "fb",
    instagram: "ig",
    gmail: "go",
    google: "go",
    twitter: "tw",
    tiktok: "tk",
    uber: "ub",
    amazon: "am",
    paypal: "pp"
  };

  return map[normalized] || normalized;
};