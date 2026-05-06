import axios from "axios";

const BASE_URL = "https://api.pvapins.com/user/api";

let pvapinsCountryCache = {
  data: [],
  map: new Map(),
  expiresAt: 0
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const normalizeDisplayText = (value) => String(value || "").trim();

const buildCountryAliases = (country = {}) => {
  const id = String(country.id || country.providerCountryId || "").trim();
  const name = normalizeDisplayText(
    country.full_name || country.name || country.country || country.label
  );

  const aliases = new Set();

  if (id) aliases.add(normalizeText(id));
  if (name) aliases.add(normalizeText(name));

  const upperName = name.toUpperCase();

  if (upperName === "USA" || upperName === "UNITED STATES") {
    aliases.add(normalizeText("US"));
    aliases.add(normalizeText("USA"));
    aliases.add(normalizeText("United States"));
    aliases.add(normalizeText("United States of America"));
  }

  if (upperName === "UK" || upperName === "UNITED KINGDOM") {
    aliases.add(normalizeText("UK"));
    aliases.add(normalizeText("GB"));
    aliases.add(normalizeText("Great Britain"));
    aliases.add(normalizeText("United Kingdom"));
  }

  if (upperName === "UAE" || upperName === "UNITED ARAB EMIRATES") {
    aliases.add(normalizeText("UAE"));
    aliases.add(normalizeText("United Arab Emirates"));
  }

  return [...aliases].filter(Boolean);
};

const parseArrayResponse = (data) => {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.countries)) return data.countries;
  if (Array.isArray(data?.services)) return data.services;
  if (Array.isArray(data?.apps)) return data.apps;
  if (Array.isArray(data?.result)) return data.result;

  return [];
};

const pvapinsGet = async (endpoint, params = {}, options = {}) => {
  const apiKey = process.env.PVAPINS_API_KEY;
  const requiresAuth = options.requiresAuth !== false;

  if (requiresAuth && !apiKey) {
    throw new Error("PVAPINS_API_KEY is missing in your .env file");
  }

  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      params,
      timeout: 20000
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

const loadPvapinsCountryCatalog = async () => {
  const now = Date.now();

  if (pvapinsCountryCache.data.length && pvapinsCountryCache.expiresAt > now) {
    return pvapinsCountryCache;
  }

  const data = await pvapinsGet("load_countries.php", {}, { requiresAuth: false });
  const rawCountries = parseArrayResponse(data);

  const countries = rawCountries
    .map((country) => {
      const id = String(country?.id || "").trim();
      const name = normalizeDisplayText(
        country?.full_name || country?.name || country?.country
      );

      if (!id || !name) return null;

      return {
        provider: "pvapins",
        id,
        providerCountryId: id,
        name,
        label: name,
        value: name,
        raw: country
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  const map = new Map();

  countries.forEach((country) => {
    buildCountryAliases(country).forEach((alias) => {
      map.set(alias, country.providerCountryId);
    });
  });

  pvapinsCountryCache = {
    data: countries,
    map,
    expiresAt: now + 1000 * 60 * 60 * 6
  };

  return pvapinsCountryCache;
};

const mapPvapinsCountry = async (country) => {
  const normalized = normalizeText(country);

  if (!normalized) {
    throw new Error("PVAPins country is required");
  }

  const catalog = await loadPvapinsCountryCatalog();
  const mappedCountryId = catalog.map.get(normalized);

  if (mappedCountryId) {
    return mappedCountryId;
  }

  const directCountryId = String(country || "").trim();

  if (/^\d+$/.test(directCountryId)) {
    return directCountryId;
  }

  throw new Error(`PVAPins country not found in catalog: ${country}`);
};

const resolvePvapinsServiceId = async (country, service) => {
  const mappedCountry = await mapPvapinsCountry(country);

  const services = await pvapinsGet(
    "load_apps.php",
    {
      country_id: mappedCountry
    },
    { requiresAuth: false }
  );

  const serviceCatalog = parseArrayResponse(services);
  const normalizedWanted = normalizeText(service);

  if (!serviceCatalog.length) {
    throw new Error(
      `PVAPins service catalog is empty for country ${mappedCountry}`
    );
  }

  const scoredMatches = serviceCatalog
    .filter((item) => {
      const normalizedName = normalizeText(
        item.full_name || item.name || item.app || item.service
      );

      return (
        normalizedName === normalizedWanted ||
        normalizedName.startsWith(normalizedWanted) ||
        normalizedName.includes(normalizedWanted) ||
        normalizedWanted.includes(normalizedName)
      );
    })
    .map((item) => {
      const normalizedName = normalizeText(
        item.full_name || item.name || item.app || item.service
      );

      let score = 1;

      if (normalizedName === normalizedWanted) score = 4;
      else if (normalizedName.startsWith(normalizedWanted)) score = 3;
      else if (normalizedWanted.includes(normalizedName)) score = 2;

      return {
        ...item,
        matchScore: score,
        deductValue: Number(item.deduct || item.price || item.cost || 0)
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
    countryId: mappedCountry,
    appId: bestMatch.id,
    appName: bestMatch.full_name || bestMatch.name || bestMatch.app,
    appDeduct: Number(bestMatch.deduct || bestMatch.price || bestMatch.cost || 0),
    catalog: serviceCatalog,
    matches: scoredMatches
  };
};

export const pvapinsProvider = {
  name: "pvapins",

  async getCountries() {
    const catalog = await loadPvapinsCountryCatalog();
    return catalog.data;
  },

  async getServices(country) {
    const countryValue =
      typeof country === "object" ? country.country || country.countryId : country;

    const mappedCountry = await mapPvapinsCountry(countryValue);

    const data = await pvapinsGet(
      "load_apps.php",
      {
        country_id: mappedCountry
      },
      { requiresAuth: false }
    );

    const services = parseArrayResponse(data);

    return services
      .map((service) => {
        const id = String(service?.id || "").trim();
        const name = normalizeDisplayText(
          service?.full_name || service?.name || service?.app || service?.service
        );

        if (!id || !name) return null;

        return {
          provider: "pvapins",
          id,
          providerServiceId: id,
          name,
          displayName: name,
          country: mappedCountry,
          providerPrice: Number(service?.deduct || service?.price || service?.cost || 0),
          providerCurrency: "USD",
          stock: 1,
          available: true,
          raw: service
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getPrice({ country, service }) {
    const resolved = await resolvePvapinsServiceId(country, service);

    const data = await pvapinsGet("get_rates.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: resolved.countryId,
      app: resolved.appId
    });

    if (Array.isArray(data) && data.length === 0) {
      return {
        provider: "pvapins",
        providerPrice: Number(resolved.appDeduct || 0),
        providerCurrency: "USD",
        stock: 1,
        raw: {
          source: "load_apps fallback",
          countryId: resolved.countryId,
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
        data?.price ||
          data?.rate ||
          data?.cost ||
          data?.deduct ||
          resolved.appDeduct ||
          0
      ),
      providerCurrency: "USD",
      stock: Number(data?.stock || data?.count || data?.available || 0),
      raw: {
        ...((typeof data === "object" && data) || {}),
        countryId: resolved.countryId,
        appId: resolved.appId,
        appName: resolved.appName
      }
    };
  },

  async buyTemporaryNumber({ country, service, operator }) {
    const resolved = await resolvePvapinsServiceId(country, service);

    const data = await pvapinsGet("get_number.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: resolved.countryId,
      app: resolved.appId,
      ...(operator ? { operator } : {})
    });

    const providerOrderId = data?.id || data?.order_id || data?.number;
    const phoneNumber = data?.number;

    if (!providerOrderId || !phoneNumber) {
      throw new Error(`PVAPins purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "pvapins",
      providerOrderId: String(providerOrderId),
      phoneNumber: String(phoneNumber),
      raw: {
        ...data,
        countryId: resolved.countryId,
        appId: resolved.appId,
        appName: resolved.appName
      }
    };
  },

  async buyRentalNumber({ country, service, operator }) {
    const resolved = await resolvePvapinsServiceId(country, service);

    const data = await pvapinsGet("get_number.php", {
      customer: process.env.PVAPINS_API_KEY,
      country: resolved.countryId,
      app: resolved.appId,
      type: "rent",
      ...(operator ? { operator } : {})
    });

    const providerOrderId = data?.id || data?.order_id || data?.number;
    const phoneNumber = data?.number;

    if (!providerOrderId || !phoneNumber) {
      throw new Error(`PVAPins rental purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "pvapins",
      providerOrderId: String(providerOrderId),
      phoneNumber: String(phoneNumber),
      raw: {
        ...data,
        countryId: resolved.countryId,
        appId: resolved.appId,
        appName: resolved.appName
      }
    };
  },

  async checkSms({ phoneNumber, country, service, operator }) {
    const resolved = await resolvePvapinsServiceId(country, service);

    const data = await pvapinsGet("get_sms.php", {
      customer: process.env.PVAPINS_API_KEY,
      number: phoneNumber,
      country: resolved.countryId,
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