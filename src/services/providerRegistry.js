import { tigerProvider } from "./providers/tiger.provider.js";
import { smsPoolProvider } from "./providers/smspool.provider.js";
import { pvapinsProvider } from "./providers/pvapins.provider.js";
import { juicySmsProvider } from "./providers/juicysms.provider.js";

export const providers = {
  juicysms: juicySmsProvider,
  smspool: smsPoolProvider,
  pvapins: pvapinsProvider,
  tiger: tigerProvider
};

export const TEMP_PROVIDER_PRIORITY = ["smspool", "juicysms", "pvapins", "tiger"];
export const RENT_PROVIDER_PRIORITY = ["smspool", "pvapins", "juicysms", "tiger"];

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