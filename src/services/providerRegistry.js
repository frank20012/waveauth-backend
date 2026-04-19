import { tigerProvider } from "./providers/tiger.provider.js";
import { smsPoolProvider } from "./providers/smspool.provider.js";
import { pvapinsProvider } from "./providers/pvapins.provider.js";

export const providers = {
  tiger: tigerProvider,
  smspool: smsPoolProvider,
  pvapins: pvapinsProvider
};

export const TEMP_PROVIDER_PRIORITY = ["smspool", "tiger", "pvapins"];
export const RENT_PROVIDER_PRIORITY = ["smspool", "pvapins", "tiger"];

export const getProvider = (providerName) => {
  return providers[providerName] || null;
};

export const getAllProviders = () => {
  return Object.values(providers);
};

export const getProviderNames = () => {
  return Object.keys(providers);
};

export const getProviderPriority = (type = "temporary") => {
  return type === "rental" ? RENT_PROVIDER_PRIORITY : TEMP_PROVIDER_PRIORITY;
};

export const getPrioritizedProviders = (type = "temporary") => {
  const priorityList = getProviderPriority(type);

  return priorityList
    .map((providerName) => providers[providerName])
    .filter(Boolean);
};