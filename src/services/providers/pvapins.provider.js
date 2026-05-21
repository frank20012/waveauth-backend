import axios from "axios";

const BASE_URL = "https://api.pvapins.com/user/api";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const pvapinsGet = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      params,
      timeout: 30000
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
        error.response?.data?.error ||
        JSON.stringify(error.response?.data) ||
        error.message
    );
  }
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

const mapCountry = async (country) => {
  const data = await pvapinsGet("load_countries.php");

  const countries = parseArrayResponse(data);

  const normalizedWanted = normalizeText(country);

  const found = countries.find((item) => {
    const values = [
      item.id,
      item.name,
      item.full_name,
      item.country
    ];

    return values.some(
      (value) => normalizeText(value) === normalizedWanted
    );
  });

  if (!found) {
    throw new Error(`PVAPINS country not found: ${country}`);
  }

  return String(found.id);
};

const resolveService = async (countryId, service) => {
  const data = await pvapinsGet("load_apps.php", {
    country_id: countryId
  });

  const services = parseArrayResponse(data);

  const normalizedWanted = normalizeText(service);

  let exactMatch = services.find((item) => {
    const values = [
      item.full_name,
      item.name,
      item.app,
      item.service
    ];

    return values.some(
      (value) => normalizeText(value) === normalizedWanted
    );
  });

  if (!exactMatch) {
    exactMatch = services.find((item) => {
      const values = [
        item.full_name,
        item.name,
        item.app,
        item.service
      ];

      return values.some((value) =>
        normalizeText(value).includes(normalizedWanted)
      );
    });
  }

  if (!exactMatch) {
    throw new Error(
      `PVAPINS service "${service}" not found for country ${countryId}`
    );
  }

  console.log("PVAPINS RESOLVED SERVICE:", {
    requested: service,
    resolvedId: exactMatch.id,
    resolvedName:
      exactMatch.full_name ||
      exactMatch.name ||
      exactMatch.app
  });

  return {
    appId: String(exactMatch.id),
    appName:
      exactMatch.full_name ||
      exactMatch.name ||
      exactMatch.app ||
      service
  };
};

export const pvapinsProvider = {
  name: "pvapins",

  async getCountries() {
    const data = await pvapinsGet("load_countries.php");

    return parseArrayResponse(data);
  },

  async getServices({ country }) {
    const countryId = await mapCountry(country);

    const data = await pvapinsGet("load_apps.php", {
      country_id: countryId
    });

    return parseArrayResponse(data);
  },

  async getPrice({ country, service }) {
  try {
    const normalizedCountry = String(country || "")
      .trim();

    const normalizedService = String(service || "")
      .trim()
      .toLowerCase();

    const data = await pvapinsGet(
      "get_rates.php",
      {
        customer: process.env.PVAPINS_API_KEY,
        country: normalizedCountry
      }
    );

    console.log("PVAPINS RATES RESPONSE:", data);

    if (!Array.isArray(data)) {
      return {
        provider: "pvapins",
        providerPrice: 0,
        providerCurrency: "USD",
        stock: 0,
        raw: data
      };
    }

    const matchedService = data.find((item) => {
      const appName = String(item.app || "")
        .trim()
        .toLowerCase();

      return (
        appName === normalizedService ||
        appName.includes(normalizedService)
      );
    });

    // SERVICE NOT FOUND
    if (!matchedService) {
      return {
        provider: "pvapins",
        providerPrice: 0,
        providerCurrency: "USD",
        stock: 0,
        raw: {
          message: "Service not found"
        }
      };
    }

    const providerPrice = Number(
      matchedService.rate || 0
    );

    // PVAPINS API DOES NOT PROVIDE STOCK
    // so assume available only if rate exists
    const stock = providerPrice > 0 ? 1 : 0;

    return {
      provider: "pvapins",
      providerPrice,
      providerCurrency: "USD",
      stock,
      raw: matchedService
    };
  } catch (error) {
    console.log(
      "PVAPINS GET PRICE ERROR:",
      error.message
    );

    return {
      provider: "pvapins",
      providerPrice: 0,
      providerCurrency: "USD",
      stock: 0,
      raw: {
        error: error.message
      }
    };
  }
},

  async buyTemporaryNumber({ country, service, operator }) {
    try {
      const normalizedCountry = String(country || "")
        .trim()
        .toLowerCase();

      const normalizedService = String(service || "")
        .trim()
        .toLowerCase();

      console.log("PVAPINS BUY INPUT:", {
        country: normalizedCountry,
        service: normalizedService,
        operator
      });

      const requestParams = {
        customer: process.env.PVAPINS_API_KEY,
        country: normalizedCountry,
        app: normalizedService
      };

      if (operator) {
        requestParams.operator = operator;
      }

      console.log("PVAPINS FINAL REQUEST:", requestParams);

      const data = await pvapinsGet(
        "get_number.php",
        requestParams
      );

      console.log("PVAPINS RAW RESPONSE:", data);

      /*
        ==========================================
        PVAPINS RETURNS RAW PHONE NUMBER STRING
        Example:
        93786831803
        ==========================================
      */

      if (
        typeof data === "string" ||
        typeof data === "number"
      ) {
        const rawNumber = String(data).trim();

        // provider errors
        if (
          rawNumber.toLowerCase().includes("not found") ||
          rawNumber.toLowerCase().includes("error") ||
          rawNumber.toLowerCase().includes("wait")
        ) {
          throw new Error(rawNumber);
        }

        // SUCCESS RESPONSE
        if (/^\d+$/.test(rawNumber)) {
          console.log("PVAPINS SUCCESS NUMBER:", rawNumber);

          return {
            provider: "pvapins",

            // IMPORTANT:
            // use number itself as providerOrderId
            providerOrderId: rawNumber,

            phoneNumber: rawNumber,

            raw: {
              number: rawNumber,
              providerOrderId: rawNumber,
              originalResponse: data
            }
          };
        }
      }

      /*
        JSON FALLBACK
      */

      if (typeof data === "object" && data !== null) {
        const providerOrderId =
          data.id ||
          data.order_id ||
          data.request_id ||
          data.activation_id ||
          data.number;

        const phoneNumber =
          data.number ||
          data.phone ||
          data.mobile ||
          data.full_number;

        console.log("PVAPINS EXTRACTED:", {
          providerOrderId,
          phoneNumber
        });

        if (providerOrderId && phoneNumber) {
          return {
            provider: "pvapins",
            providerOrderId: String(providerOrderId),
            phoneNumber: String(phoneNumber),
            raw: data
          };
        }
      }

      throw new Error(
        `Invalid PVAPINS response: ${JSON.stringify(data)}`
      );
    } catch (error) {
      console.log("PVAPINS BUY ERROR:", error);

      throw error;
    }
  },

  async checkSms({
    phoneNumber,
    country,
    service,
    operator
  }) {
    try {
      const normalizedCountry = String(country || "")
        .trim()
        .toLowerCase();

      const normalizedService = String(service || "")
        .trim()
        .toLowerCase();

      const requestParams = {
        customer: process.env.PVAPINS_API_KEY,
        number: phoneNumber,
        country: normalizedCountry,
        app: normalizedService
      };

      if (operator) {
        requestParams.operator = operator;
      }

      const data = await pvapinsGet(
        "get_sms.php",
        requestParams
      );

      console.log("PVAPINS SMS RESPONSE:", data);

      let otpCode = "";

      if (typeof data === "string") {
        if (
          data.toLowerCase().includes("not received") ||
          data.toLowerCase().includes("wait")
        ) {
          return {
            provider: "pvapins",
            status: "waiting_sms",
            otpCode: "",
            raw: data
          };
        }

        const match = data.match(/\d{4,8}/);

        if (match) {
          otpCode = match[0];
        }
      }

      if (typeof data === "object" && data !== null) {
        otpCode =
          data.sms ||
          data.code ||
          data.otp ||
          "";
      }

      return {
        provider: "pvapins",
        status: otpCode
          ? "otp_received"
          : "waiting_sms",
        otpCode: String(otpCode || ""),
        raw: data
      };
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async cancel({
    phoneNumber,
    country,
    service,
    operator
  }) {
    try {
      const normalizedCountry = String(country || "")
        .trim()
        .toLowerCase();

      const normalizedService = String(service || "")
        .trim()
        .toLowerCase();

      const requestParams = {
        customer: process.env.PVAPINS_API_KEY,
        number: phoneNumber,
        country: normalizedCountry,
        app: normalizedService
      };

      if (operator) {
        requestParams.operator = operator;
      }

      const data = await pvapinsGet(
        "get_reject_number.php",
        requestParams
      );

      console.log("PVAPINS CANCEL RESPONSE:", data);

      return {
        provider: "pvapins",
        success: true,
        raw: data
      };
    } catch (error) {
      return {
        provider: "pvapins",
        success: false,
        raw: {
          error: error.message
        }
      };
    }
  }
};