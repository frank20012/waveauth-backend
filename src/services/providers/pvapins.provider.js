import axios from "axios";

const BASE_URL = "https://api.pvapins.com/user/api";

const PVAPINS_COUNTRY_MAP = {
  "UNITED STATES": 58,
  "USA": 58,
  "US": 58,
  "UNITED KINGDOM": 62,
  "UK": 62,
  "CANADA": 165,
  "NIGERIA": 88,
  "NG": 88
};

const mapPvapinsCountry = (country) => {
  const normalized = String(country || "").trim().toUpperCase();
  return PVAPINS_COUNTRY_MAP[normalized] || country;
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const pvapinsGet = async (endpoint, params = {}) => {
  const apiKey = process.env.PVAPINS_API_KEY;

  if (!apiKey) {
    throw new Error("PVAPINS_API_KEY is missing in your .env file");
  }

  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      params,
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      JSON.stringify(error.response?.data) ||
      error.message;

    throw new Error(`PVAPins ${endpoint} failed: ${providerMessage}`);
  }
};

const resolvePvapinsServiceId = async (country, service) => {
  const mappedCountry = mapPvapinsCountry(country);
  const services = await pvapinsGet("load_apps.php", {
    country_id: mappedCountry
  });

  const normalizedWanted = normalizeText(service);

  if (!Array.isArray(services) || services.length === 0) {
    throw new Error(
      `PVAPins service catalog is empty for country ${mappedCountry}`
    );
  }

  const scoredMatches = services
    .filter((item) => {
      const normalizedName = normalizeText(item.full_name);
      return (
        normalizedName === normalizedWanted ||
        normalizedName.startsWith(normalizedWanted) ||
        normalizedName.includes(normalizedWanted)
      );
    })
    .map((item) => {
      const normalizedName = normalizeText(item.full_name);
      let score = 1;

      if (normalizedName === normalizedWanted) score = 3;
      else if (normalizedName.startsWith(normalizedWanted)) score = 2;

      return {
        ...item,
        matchScore: score,
        deductValue: Number(item.deduct || 0)
      };
    })
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }

      return a.deductValue - b.deductValue;
    });

  if (!scoredMatches.length) {
    throw new Error(
      `PVAPins could not resolve service "${service}" for country ${mappedCountry}`
    );
  }

  const bestMatch = scoredMatches[0];

  return {
    appId: bestMatch.id,
    appName: bestMatch.full_name,
    appDeduct: Number(bestMatch.deduct || 0),
    catalog: services,
    matches: scoredMatches
  };
};

export const pvapinsProvider = {
  name: "pvapins",

  async getCountries() {
    return pvapinsGet("load_countries.php");
  },

  async getServices(countryId) {
    return pvapinsGet("load_apps.php", {
      country_id: countryId
    });
  },

  async getPrice({ country, service }) {
    const mappedCountry = mapPvapinsCountry(country);
    const resolved = await resolvePvapinsServiceId(country, service);

    console.log("PVAPINS getPrice INPUT:", {
      originalCountry: country,
      mappedCountry,
      originalService: service,
      resolvedAppId: resolved.appId,
      resolvedAppName: resolved.appName
    });

    const data = await pvapinsGet("get_rates.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: mappedCountry,
      app: resolved.appId
    });

    console.log("PVAPINS getPrice RESPONSE:", data);

    if (Array.isArray(data) && data.length === 0) {
      return {
        provider: "pvapins",
        providerPrice: Number(resolved.appDeduct || 0),
        providerCurrency: "USD",
        stock: 1,
        raw: {
          source: "load_apps fallback",
          appId: resolved.appId,
          appName: resolved.appName,
          deduct: resolved.appDeduct,
          ratesResponse: data,
          stockMode: "estimated_from_catalog"
        }
      };
    }

    return {
      provider: "pvapins",
      providerPrice: Number(
        data?.price || data?.rate || data?.cost || data?.deduct || resolved.appDeduct || 0
      ),
      providerCurrency: "USD",
      stock: Number(data?.stock || data?.count || data?.available || 0),
      raw: data
    };
  },

  async buyTemporaryNumber({ country, service, operator }) {
    const mappedCountry = mapPvapinsCountry(country);
    const resolved = await resolvePvapinsServiceId(country, service);

    console.log("PVAPINS buyTemporaryNumber INPUT:", {
      originalCountry: country,
      mappedCountry,
      originalService: service,
      resolvedAppId: resolved.appId,
      resolvedAppName: resolved.appName,
      operator
    });

    const data = await pvapinsGet("get_number.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: mappedCountry,
      app: resolved.appId,
      ...(operator ? { operator } : {})
    });

    console.log("PVAPINS buyTemporaryNumber RESPONSE:", data);

    const providerOrderId = data?.id || data?.order_id || data?.number;
    const phoneNumber = data?.number;

    if (!providerOrderId || !phoneNumber) {
      throw new Error(`PVAPins purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "pvapins",
      providerOrderId: String(providerOrderId),
      phoneNumber: String(phoneNumber),
      raw: data
    };
  },

  async buyRentalNumber({ country, service, operator }) {
    const mappedCountry = mapPvapinsCountry(country);
    const resolved = await resolvePvapinsServiceId(country, service);

    console.log("PVAPINS buyRentalNumber INPUT:", {
      originalCountry: country,
      mappedCountry,
      originalService: service,
      resolvedAppId: resolved.appId,
      resolvedAppName: resolved.appName,
      operator
    });

    const data = await pvapinsGet("get_number.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: mappedCountry,
      app: resolved.appId,
      type: "rent",
      ...(operator ? { operator } : {})
    });

    console.log("PVAPINS buyRentalNumber RESPONSE:", data);

    const providerOrderId = data?.id || data?.order_id || data?.number;
    const phoneNumber = data?.number;

    if (!providerOrderId || !phoneNumber) {
      throw new Error(`PVAPins rental purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "pvapins",
      providerOrderId: String(providerOrderId),
      phoneNumber: String(phoneNumber),
      raw: data
    };
  },

  async checkSms({ phoneNumber, country, service, operator }) {
  const mappedCountry = mapPvapinsCountry(country);
  const resolved = await resolvePvapinsServiceId(country, service);

  const data = await pvapinsGet("get_sms.php", {
    customer: process.env.PVAPINS_API_KEY,
    number: phoneNumber,
    country: mappedCountry,
    app: resolved.appId,
    ...(operator ? { operator } : {})
  });

  const otpCode = data?.sms || data?.code || data?.otp || "";
  return {
    provider: "pvapins",
    status: otpCode ? "otp_received" : "waiting_sms",
    otpCode: String(otpCode),
    raw: data
  };
},

  async cancel({ providerOrderId, phoneNumber, country, service, operator }) {
    return {
      provider: "pvapins",
      success: false,
      raw: {
        message: "PVAPins cancel endpoint is not wired yet",
        providerOrderId,
        phoneNumber,
        country,
        service,
        operator
      }
    };
  }
};