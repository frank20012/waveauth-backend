import { smsPoolProvider } from "../services/providers/smspool.provider.js";
import { tigerProvider } from "../services/providers/tiger.provider.js";
import { pvapinsProvider } from "../services/providers/pvapins.provider.js";

const providerMap = {
  smspool: smsPoolProvider,
  tiger: tigerProvider,
  pvapins: pvapinsProvider
};

export const getProviderCountries = async (req, res) => {
  try {
    const { provider } = req.params;
    const selectedProvider = providerMap[provider];

    if (!selectedProvider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    if (typeof selectedProvider.getCountries !== "function") {
      return res.status(400).json({
        message: "This provider does not support country discovery"
      });
    }

    const data = await selectedProvider.getCountries();

    return res.status(200).json({
      provider,
      countries: data
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to fetch provider countries"
    });
  }
};

export const getProviderServices = async (req, res) => {
  try {
    const { provider } = req.params;
    const { country } = req.query;

    const selectedProvider = providerMap[provider];

    if (!selectedProvider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    if (typeof selectedProvider.getServices !== "function") {
      return res.status(400).json({
        message: "This provider does not support service discovery"
      });
    }

    const data = await selectedProvider.getServices(country);

    return res.status(200).json({
      provider,
      country: country || null,
      services: data
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to fetch provider services"
    });
  }
};

export const getProviderBalance = async (req, res) => {
  try {
    const { provider } = req.params;
    const selectedProvider = providerMap[provider];

    if (!selectedProvider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    if (typeof selectedProvider.getBalance !== "function") {
      return res.status(400).json({
        message: "This provider does not support balance check"
      });
    }

    const data = await selectedProvider.getBalance();

    return res.status(200).json({
      provider,
      balance: data
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Failed to fetch provider balance"
    });
  }
};