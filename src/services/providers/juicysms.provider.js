import axios from "axios";
import {
  JUICYSMS_SERVICE_CATALOG,
  getJuicyCountryCode,
  findJuicyService
} from "../../config/juicysmsCatalog.js";

const JUICYSMS_API_KEY = process.env.JUICYSMS_API_KEY || "";
const JUICYSMS_BASE_URL = process.env.JUICYSMS_BASE_URL || "https://juicysms.com";

const createClient = () =>
  axios.create({
    baseURL: JUICYSMS_BASE_URL,
    timeout: 20000
  });

const normalizeResponseData = (data) => {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return data.trim();
    }
  }

  return data;
};

const parseOrderResponse = (payload) => {
  if (!payload) return null;

  if (typeof payload === "object") {
    const phoneNumber =
      payload.number ||
      payload.phone ||
      payload.phonenumber ||
      payload.msisdn ||
      payload.data?.number ||
      "";

    const providerOrderId =
      payload.orderId ||
      payload.order_id ||
      payload.id ||
      payload.data?.orderId ||
      payload.data?.id ||
      "";

    return {
      phoneNumber: String(phoneNumber || ""),
      providerOrderId: String(providerOrderId || ""),
      raw: payload
    };
  }

  if (typeof payload === "string") {
    const text = payload.trim();

    const phoneMatch =
      text.match(/(?:number|phone|msisdn)[=:]\s*([+\d]+)/i) ||
      text.match(/\b(\+?\d{7,15})\b/);

    const orderMatch =
      text.match(/(?:orderid|order_id|id)[=:]\s*([a-z0-9_-]+)/i);

    return {
      phoneNumber: phoneMatch?.[1] ? String(phoneMatch[1]) : "",
      providerOrderId: orderMatch?.[1] ? String(orderMatch[1]) : "",
      raw: text
    };
  }

  return null;
};

const parseSmsResponse = (payload) => {
  if (!payload) {
    return {
      status: "active",
      otpCode: "",
      raw: payload
    };
  }

  if (typeof payload === "object") {
    const otpCode =
      payload.code ||
      payload.sms ||
      payload.message ||
      payload.otp ||
      payload.data?.code ||
      payload.data?.sms ||
      "";

    const explicitStatus = String(
      payload.status || payload.state || payload.data?.status || ""
    ).toLowerCase();

    if (otpCode) {
      return {
        status: "otp_received",
        otpCode: String(otpCode),
        raw: payload
      };
    }

    if (explicitStatus.includes("cancel")) {
      return {
        status: "cancelled",
        otpCode: "",
        raw: payload
      };
    }

    return {
      status: "active",
      otpCode: "",
      raw: payload
    };
  }

  const text = String(payload).trim();

  if (/cancel/i.test(text)) {
    return {
      status: "cancelled",
      otpCode: "",
      raw: text
    };
  }

  const otpMatch =
    text.match(/(?:code|sms|otp)[=:]\s*([a-z0-9-]+)/i) ||
    text.match(/\b(\d{4,8})\b/);

  if (otpMatch?.[1]) {
    return {
      status: "otp_received",
      otpCode: String(otpMatch[1]),
      raw: text
    };
  }

  return {
    status: "active",
    otpCode: "",
    raw: text
  };
};

const ensureJuicyCredentials = () => {
  if (!JUICYSMS_API_KEY) {
    throw new Error("JUICYSMS_API_KEY is missing");
  }
};

const getMappedService = (service) => {
  const mapped = findJuicyService(service);

  if (!mapped) {
    throw new Error(`JuicySMS service mapping not found for: ${service}`);
  }

  return mapped;
};

const getMappedCountry = (country) => {
  const mappedCountry = getJuicyCountryCode(country);

  if (!mappedCountry) {
    throw new Error(`JuicySMS unsupported country: ${country}`);
  }

  return mappedCountry;
};

export const juicySmsProvider = {
  name: "juicysms",

  async getBalance() {
    ensureJuicyCredentials();

    const client = createClient();
    const response = await client.get("/api/getbalance", {
      params: {
        key: JUICYSMS_API_KEY
      }
    });

    const data = normalizeResponseData(response.data);

    let balance = 0;

    if (typeof data === "object") {
      balance = Number(data.balance || data.amount || data.data?.balance || 0);
    } else {
      const match = String(data).match(/([0-9]+(?:\.[0-9]+)?)/);
      balance = Number(match?.[1] || 0);
    }

    return {
      provider: "juicysms",
      balance,
      raw: data
    };
  },

  async getCountries() {
    const supportedCountries = ["USA", "UK", "NL", "PH"];

    return supportedCountries.map((code) => ({
      code,
      name: code
    }));
  },

  async getServices({ country }) {
    const mappedCountry = getMappedCountry(country);

    return JUICYSMS_SERVICE_CATALOG.map((service) => ({
      provider: "juicysms",
      id: service.id,
      name: service.name,
      country: mappedCountry,
      providerPrice: Number(service.priceUsd || 0),
      providerCurrency: "USD",
      stock: 1,
      available: true
    }));
  },

  async getPrice({ country, service }) {
    const mappedCountry = getMappedCountry(country);
    const mappedService = getMappedService(service);

    return {
      providerPrice: Number(mappedService.priceUsd || 0),
      providerPriceUsd: Number(mappedService.priceUsd || 0),
      providerCurrency: "USD",
      stock: 1,
      raw: {
        serviceId: mappedService.id,
        serviceName: mappedService.name,
        country: mappedCountry,
        source: "juicysms_catalog"
      }
    };
  },

  async buyTemporaryNumber({ country, service }) {
    ensureJuicyCredentials();

    const mappedCountry = getMappedCountry(country);
    const mappedService = getMappedService(service);

    const client = createClient();

    const response = await client.get("/api/makeorder", {
      params: {
        key: JUICYSMS_API_KEY,
        serviceId: mappedService.id,
        country: mappedCountry
      }
    });

    const data = normalizeResponseData(response.data);
    const parsed = parseOrderResponse(data);

    if (!parsed?.phoneNumber || !parsed?.providerOrderId) {
      throw new Error(
        typeof data === "string"
          ? `JuicySMS buy failed: ${data}`
          : "JuicySMS buy failed"
      );
    }

    return {
      phoneNumber: parsed.phoneNumber,
      providerOrderId: parsed.providerOrderId,
      raw: {
        ...((typeof parsed.raw === "object" && parsed.raw) || {}),
        serviceId: mappedService.id,
        serviceName: mappedService.name,
        country: mappedCountry,
        currency: "USD",
        price: Number(mappedService.priceUsd || 0)
      }
    };
  },

  async checkSms({ providerOrderId }) {
    ensureJuicyCredentials();

    const client = createClient();
    const response = await client.get("/api/getsms", {
      params: {
        key: JUICYSMS_API_KEY,
        orderId: providerOrderId
      }
    });

    const data = normalizeResponseData(response.data);
    return parseSmsResponse(data);
  },

  async cancel({ providerOrderId }) {
    ensureJuicyCredentials();

    const client = createClient();
    const response = await client.get("/api/cancelorder", {
      params: {
        key: JUICYSMS_API_KEY,
        orderId: providerOrderId
      }
    });

    const data = normalizeResponseData(response.data);

    const success =
      (typeof data === "object" && (data.success === true || data.status === "cancelled")) ||
      (typeof data === "string" && /cancel|success|ok/i.test(data));

    return {
      success: Boolean(success),
      raw: data
    };
  },

  async skipNumber({ providerOrderId }) {
    ensureJuicyCredentials();

    const client = createClient();
    const response = await client.get("/api/skipnumber", {
      params: {
        key: JUICYSMS_API_KEY,
        orderId: providerOrderId
      }
    });

    return {
      success: true,
      raw: normalizeResponseData(response.data)
    };
  },

  async reuseNumber({ providerOrderId }) {
    ensureJuicyCredentials();

    const client = createClient();
    const response = await client.get("/api/reuse", {
      params: {
        key: JUICYSMS_API_KEY,
        orderId: providerOrderId
      }
    });

    return {
      success: true,
      raw: normalizeResponseData(response.data)
    };
  }
};