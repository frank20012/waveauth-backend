import axios from "axios";

const BASE_URL = "https://api.smspool.net";

const smsPoolGet = async (endpoint, params = {}) => {
  const apiKey = process.env.SMSPOOL_API_KEY;

  if (!apiKey) {
    throw new Error("SMSPOOL_API_KEY is missing in your .env file");
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: {
        key: apiKey,
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

    throw new Error(`SMSPool GET ${endpoint} failed: ${providerMessage}`);
  }
};

const smsPoolPost = async (endpoint, body = {}) => {
  const apiKey = process.env.SMSPOOL_API_KEY;

  if (!apiKey) {
    throw new Error("SMSPOOL_API_KEY is missing in your .env file");
  }

  const form = new URLSearchParams();
  form.append("key", apiKey);

  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      form.append(key, String(value));
    }
  });

  try {
    const response = await axios.post(`${BASE_URL}${endpoint}`, form.toString(), {
      timeout: 15000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    return response.data;
  } catch (error) {
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      JSON.stringify(error.response?.data) ||
      error.message;

    console.log("SMSPOOL POST ERROR:", {
      endpoint,
      requestBody: body,
      responseData: error.response?.data || null,
      status: error.response?.status || null
    });

    throw new Error(`SMSPool POST ${endpoint} failed: ${providerMessage}`);
  }
};

export const smsPoolProvider = {
  name: "smspool",

  async getBalance() {
    return smsPoolPost("/request/balance");
  },

  async getCountries() {
    return smsPoolGet("/country/retrieve_all");
  },

  async getServices(country) {
    return smsPoolGet("/service/retrieve_all", country ? { country } : {});
  },

  async getPrice({ country, service, type = "temporary" }) {
    const endpoint = type === "rental" ? "/rental/stock" : "/sms/stock";

    console.log("SMSPOOL getPrice INPUT:", { country, service, type, endpoint });

    const data = await smsPoolPost(endpoint, {
      country,
      service
    });

    console.log("SMSPOOL getPrice RESPONSE:", data);

    return {
      provider: "smspool",
      providerPrice: Number(data?.cost || data?.price || 0),
      providerCurrency: "USD",
      stock: Number(data?.stock || data?.amount || 0),
      raw: data
    };
  },

  async buyTemporaryNumber({ country, service }) {
    console.log("SMSPOOL buyTemporaryNumber INPUT:", { country, service });

    const data = await smsPoolPost("/purchase/sms", {
      country,
      service,
      pricing_option: 0,
      quantity: 1,
      activation_type: "SMS"
    });

    console.log("SMSPOOL buyTemporaryNumber RESPONSE:", data);

    if (!data?.order_id || !data?.number) {
      throw new Error(`SMSPool purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "smspool",
      providerOrderId: String(data.order_id),
      phoneNumber: String(data.number),
      raw: data
    };
  },

  async buyRentalNumber({ country, service }) {
    console.log("SMSPOOL buyRentalNumber INPUT:", { country, service });

    const data = await smsPoolPost("/rental/purchase", {
      country,
      service,
      quantity: 1
    });

    console.log("SMSPOOL buyRentalNumber RESPONSE:", data);

    if (!(data?.order_id || data?.id) || !data?.number) {
      throw new Error(`SMSPool rental purchase failed: ${JSON.stringify(data)}`);
    }

    return {
      provider: "smspool",
      providerOrderId: String(data.order_id || data.id),
      phoneNumber: String(data.number),
      raw: data
    };
  },

  async checkSms({ providerOrderId }) {
    const data = await smsPoolPost("/sms/check", {
      orderid: providerOrderId
    });

    const otpCode = data?.sms || data?.code || "";
    const statusCode = Number(data?.status);

    if (otpCode) {
      return {
        provider: "smspool",
        status: "otp_received",
        otpCode: String(otpCode),
        raw: data
      };
    }

    if (
      statusCode === 6 ||
      String(data?.message || "").toLowerCase().includes("refunded") ||
      String(data?.message || "").toLowerCase().includes("archived") ||
      String(data?.message || "").toLowerCase().includes("cancel")
    ) {
      return {
        provider: "smspool",
        status: "cancelled",
        otpCode: "",
        raw: data
      };
    }

    return {
      provider: "smspool",
      status: "waiting_sms",
      otpCode: "",
      raw: data
    };
  },

  async cancel({ providerOrderId }) {
    const data = await smsPoolPost("/sms/cancel", {
      orderid: providerOrderId
    });

    return {
      provider: "smspool",
      success: Boolean(data?.success) || data === 1,
      raw: data
    };
  }
};