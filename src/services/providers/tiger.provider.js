import axios from "axios";

const BASE_URL = "https://api.tiger-sms.com/stubs/handler_api.php";

const TIGER_COUNTRY_MAP = {
  "UNITED STATES": "1",
  "USA": "1",
  "US": "1",
  "NIGERIA": "160",
  "NG": "160",
  "UNITED KINGDOM": "16",
  "UK": "16",
  "ENGLAND": "16",
  "CANADA": "36",
  "CA": "36",
  "AUSTRALIA": "6",
  "AU": "6",
  "GERMANY": "43",
  "DE": "43",
  "FRANCE": "78",
  "FR": "78",
  "NETHERLANDS": "48",
  "NL": "48",
  "SWEDEN": "46",
  "SE": "46",
  "INDIA": "22",
  "IN": "22",
  "SPAIN": "56",
  "ES": "56",
  "ITALY": "86",
  "IT": "86",
  "POLAND": "15",
  "PL": "15",
  "PORTUGAL": "117",
  "PT": "117",
  "BELGIUM": "82",
  "BE": "82",
  "BRAZIL": "73",
  "BR": "73",
  "MEXICO": "54",
  "MX": "54",
  "RUSSIA": "0",
  "RU": "0",
  "UKRAINE": "1",
  "UA": "1",
  "UNITED ARAB EMIRATES": "165",
  "UAE": "165",
  "SOUTH AFRICA": "31",
  "ZA": "31"
};

const TIGER_SERVICE_ALIASES = {
  whatsapp: ["wa"],
  telegram: ["tg"],
  facebook: ["fb"],
  instagram: ["ig"],
  google: ["go"],
  gmail: ["go"],
  tiktok: ["tk"],
  discord: ["dc"],
  amazon: ["am"],
  line: ["li"]
};

const mapTigerCountry = (country) => {
  const normalized = String(country || "").trim().toUpperCase();
  return TIGER_COUNTRY_MAP[normalized] || null;
};

const ensureTigerCountrySupported = (country) => {
  const tigerCountry = mapTigerCountry(country);

  if (!tigerCountry) {
    throw new Error(`Tiger unsupported country: ${country}`);
  }

  return tigerCountry;
};

const getTigerServiceCandidates = (service) => {
  const normalized = String(service || "").trim().toLowerCase();
  return TIGER_SERVICE_ALIASES[normalized] || [normalized];
};

const tigerRequest = async (params = {}) => {
  const apiKey = process.env.TIGER_API_KEY;

  if (!apiKey) {
    throw new Error("TIGER_API_KEY is missing in your .env file");
  }

  try {
    const response = await axios.get(BASE_URL, {
      params: {
        api_key: apiKey,
        ...params
      },
      timeout: 15000
    });

    return response.data;
  } catch (error) {
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      JSON.stringify(error.response?.data) ||
      error.message;

    throw new Error(`Tiger request failed: ${providerMessage}`);
  }
};

const parseAccessNumberResponse = (response) => {
  if (typeof response !== "string") {
    throw new Error("Invalid Tiger response format");
  }

  if (!response.startsWith("ACCESS_NUMBER")) {
    throw new Error(`Tiger provider error: ${response}`);
  }

  const parts = response.split(":");

  return {
    providerOrderId: parts[1],
    phoneNumber: parts[2]
  };
};

const isTigerErrorString = (data) => {
  return (
    typeof data === "string" &&
    [
      "BAD_COUNTRY",
      "BAD_SERVICE",
      "BAD_VALUES",
      "NO_NUMBERS",
      "BAD_KEY",
      "BAD_ACTION"
    ].includes(data)
  );
};

const extractTigerPriceResult = (data, countryCode, serviceCode) => {
  if (Array.isArray(data) && data.length === 0) {
    return null;
  }

  if (typeof data === "string") {
    return null;
  }

  const serviceData = data?.[countryCode]?.[serviceCode];

  if (!serviceData) {
    return null;
  }

  return {
    providerPrice: Number(serviceData.cost || 0),
    providerCurrency: "RUB",
    stock: Number(serviceData.count || 0),
    raw: data
  };
};

const resolveTigerServiceForPricing = async (country, service) => {
  const tigerCountry = ensureTigerCountrySupported(country);
  const candidates = getTigerServiceCandidates(service);
  const attempts = [];

  for (const candidate of candidates) {
    const data = await tigerRequest({
      action: "getPrices",
      country: tigerCountry,
      service: candidate
    });

    attempts.push({
      country: tigerCountry,
      service: candidate,
      raw: data
    });

    if (isTigerErrorString(data)) {
      continue;
    }

    const parsed = extractTigerPriceResult(data, tigerCountry, candidate);

    if (parsed) {
      return {
        resolvedCountry: tigerCountry,
        resolvedService: candidate,
        ...parsed,
        attempts
      };
    }
  }

  return {
    resolvedCountry: tigerCountry,
    resolvedService: candidates[0],
    providerPrice: 0,
    providerCurrency: "RUB",
    stock: 0,
    raw: attempts.at(-1)?.raw || [],
    attempts
  };
};

const resolveTigerServiceForPurchase = async (country, service, activationType) => {
  const tigerCountry = ensureTigerCountrySupported(country);
  const candidates = getTigerServiceCandidates(service);
  const attempts = [];

  for (const candidate of candidates) {
    console.log("TIGER PURCHASE TRY:", {
  country: tigerCountry,
  service: candidate,
  activationType
});
    const data = await tigerRequest({
      action: "getNumber",
      country: tigerCountry,
      service: candidate,
      activationType
    });
console.log("TIGER PURCHASE RESPONSE:", data);
    attempts.push({
      country: tigerCountry,
      service: candidate,
      raw: data
    });

    if (typeof data === "string" && data.startsWith("ACCESS_NUMBER")) {
      const parsed = parseAccessNumberResponse(data);

      return {
        resolvedCountry: tigerCountry,
        resolvedService: candidate,
        providerOrderId: parsed.providerOrderId,
        phoneNumber: parsed.phoneNumber,
        raw: data,
        attempts
      };
    }

    if (isTigerErrorString(data)) {
      continue;
    }
  }

  const lastRaw = attempts.at(-1)?.raw || "NO_NUMBERS";
  throw new Error(`Tiger provider error: ${lastRaw}`);
};

export const tigerProvider = {
  name: "tiger",

  async getBalance() {
    return tigerRequest({
      action: "getBalance"
    });
  },

  async getPrice({ country, service }) {
    const resolved = await resolveTigerServiceForPricing(country, service);

    return {
      provider: "tiger",
      providerPrice: Number(resolved.providerPrice || 0),
      providerCurrency: "RUB",
      stock: Number(resolved.stock || 0),
      raw: resolved.raw,
      attempts: resolved.attempts
    };
  },

  async buyTemporaryNumber({ country, service }) {
    const resolved = await resolveTigerServiceForPurchase(
      country,
      service,
      "SMS"
    );

    return {
      provider: "tiger",
      providerOrderId: resolved.providerOrderId,
      phoneNumber: resolved.phoneNumber,
      raw: resolved.raw
    };
  },

  async buyRentalNumber({ country, service }) {
    const resolved = await resolveTigerServiceForPurchase(
      country,
      service,
      "RENT_SMS"
    );

    return {
      provider: "tiger",
      providerOrderId: resolved.providerOrderId,
      phoneNumber: resolved.phoneNumber,
      raw: resolved.raw
    };
  },

  async checkSms({ providerOrderId }) {
    const data = await tigerRequest({
      action: "getStatus",
      id: providerOrderId
    });

    if (typeof data === "string" && data.startsWith("STATUS_OK")) {
      const parts = data.split(":");

      return {
        provider: "tiger",
        status: "otp_received",
        otpCode: parts[1] || "",
        raw: data
      };
    }

    if (data === "STATUS_WAIT_CODE" || data === "STATUS_WAIT_RETRY") {
      return {
        provider: "tiger",
        status: "waiting_sms",
        otpCode: "",
        raw: data
      };
    }

    if (data === "ACCESS_CANCEL") {
      return {
        provider: "tiger",
        status: "cancelled",
        otpCode: "",
        raw: data
      };
    }

    return {
      provider: "tiger",
      status: "pending",
      otpCode: "",
      raw: data
    };
  },

  async cancel({ providerOrderId }) {
    const data = await tigerRequest({
      action: "setStatus",
      id: providerOrderId,
      status: 8
    });

    return {
      provider: "tiger",
      success: data === "ACCESS_CANCEL",
      raw: data
    };
  }
};