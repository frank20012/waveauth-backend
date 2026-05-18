import { smsPoolProvider } from "./providers/smspool.provider.js";
import { pvapinsProvider } from "./providers/pvapins.provider.js";
import { juicySmsProvider } from "./providers/juicysms.provider.js";

export const providers = {
  pvapins: pvapinsProvider,
  juicysms: juicySmsProvider,
  smspool: smsPoolProvider,
};

export const TEMP_PROVIDER_PRIORITY = ["smspool", "pvapins", "juicysms"];
export const RENT_PROVIDER_PRIORITY = ["smspool", "pvapins", "juicysms"];

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