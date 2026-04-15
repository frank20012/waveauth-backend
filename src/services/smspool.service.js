import axios from "axios";

const BASE_URL = "https://api.smspool.net";
const API_KEY = process.env.SMSPOOL_API_KEY;

const buildFormBody = (payload = {}) => {
  const form = new URLSearchParams();

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      form.append(key, value);
    }
  });

  return form;
};

export const getSmsPoolCountries = async () => {
  const response = await axios.get(`${BASE_URL}/country/retrieve_all`);
  return response.data;
};

export const getSmsPoolServices = async (country) => {
  const response = await axios.get(`${BASE_URL}/service/retrieve_all`, {
    params: { country }
  });

  return response.data;
};

export const getSmsPoolPricing = async ({ country, service, pool, max_price }) => {
  const response = await axios.post(
    `${BASE_URL}/request/pricing`,
    buildFormBody({
      key: API_KEY,
      country,
      service,
      pool,
      max_price
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      }
    }
  );

  return response.data;
};

export const purchaseSmsPoolNumber = async ({
  country,
  service,
  pool,
  max_price,
  pricing_option = 1,
  quantity = 1
}) => {
  const response = await axios.post(
    `${BASE_URL}/purchase/sms`,
    buildFormBody({
      key: API_KEY,
      country,
      service,
      pool,
      max_price,
      pricing_option,
      quantity
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      }
    }
  );

  return response.data;
};

export const checkSmsPoolOrder = async (orderid) => {
  const response = await axios.post(
    `${BASE_URL}/sms/check`,
    buildFormBody({
      key: API_KEY,
      orderid
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      }
    }
  );

  return response.data;
};