import axios from "axios";

const API_KEY = process.env.FIVESIM_API_KEY;
const BASE_URL = process.env.FIVESIM_BASE_URL || "https://5sim.net/v1";

export const checkOtpStatus = async (providerOrderId) => {
  const response = await axios.get(`${BASE_URL}/user/check/${providerOrderId}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${API_KEY}`
    }
  });

  return response.data;
};