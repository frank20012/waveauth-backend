import axios from "axios";

const BASE_URL = process.env.FIVESIM_BASE_URL || "https://5sim.net/v1";
const API_KEY = process.env.FIVESIM_API_KEY;

const guestApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: "application/json"
  }
});

const userApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${API_KEY}`
  }
});

export const getCountries = async () => {
  const response = await guestApi.get("/guest/countries");
  return response.data;
};

export const getPricesByCountry = async (country) => {
  const normalizedCountry = String(country || "").trim().toLowerCase();

  const response = await guestApi.get("/guest/prices", {
    params: { country: normalizedCountry }
  });

  return response.data;
};

export const buyActivationNumber = async ({ country, product, operator = "any" }) => {
  const normalizedCountry = String(country || "").trim().toLowerCase();
  const normalizedProduct = String(product || "").trim().toLowerCase();
  const normalizedOperator = String(operator || "any").trim().toLowerCase();

  const response = await userApi.get(
    `/user/buy/activation/${normalizedCountry}/${normalizedOperator}/${normalizedProduct}`
  );

  return response.data;
};

export const checkActivationOrder = async (providerOrderId) => {
  const response = await userApi.get(`/user/check/${providerOrderId}`);
  return response.data;
};

export const cancelActivationOrder = async (providerOrderId) => {
  const response = await userApi.get(`/user/cancel/${providerOrderId}`);
  return response.data;
};

export const finishActivationOrder = async (providerOrderId) => {
  const response = await userApi.get(`/user/finish/${providerOrderId}`);
  return response.data;
};

export const banActivationOrder = async (providerOrderId) => {
  const response = await userApi.get(`/user/ban/${providerOrderId}`);
  return response.data;
};

export const getProviderProfile = async () => {
  const response = await userApi.get("/user/profile");
  return response.data;
};