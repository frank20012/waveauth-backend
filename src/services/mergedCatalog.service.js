import { smsPoolProvider } from "./providers/smspool.provider.js";
import { tigerProvider } from "./providers/tiger.provider.js";
import { pvapinsProvider } from "./providers/pvapins.provider.js";

const COUNTRY_ALIASES = {
  US: "UNITED STATES",
  USA: "UNITED STATES",
  UK: "UNITED KINGDOM",
  UAE: "UNITED ARAB EMIRATES",
  NG: "NIGERIA",
  CA: "CANADA",
  AU: "AUSTRALIA",
  DE: "GERMANY",
  FR: "FRANCE",
  NL: "NETHERLANDS",
  SE: "SWEDEN",
  IN: "INDIA"
};

const TIGER_SEEDED_COUNTRIES = [
  "UNITED STATES",
  "UNITED KINGDOM",
  "CANADA",
  "NIGERIA"
];

const TIGER_SEEDED_SERVICES = [
  "whatsapp",
  "telegram",
  "facebook",
  "instagram",
  "google",
  "gmail",
  "tiktok",
  "discord",
  "amazon",
  "line"
];

const normalizeCountryName = (value) => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  return COUNTRY_ALIASES[raw] || raw;
};

const normalizeServiceKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const prettifyServiceName = (value) => {
  const normalized = normalizeServiceKey(value);
  if (!normalized) return "";
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
};

const extractSmsPoolCountries = (data) => {
  if (Array.isArray(data)) {
    return data
      .map((item) =>
        normalizeCountryName(
          item?.name || item?.country || item?.label || item?.title || item
        )
      )
      .filter(Boolean);
  }

  if (data && typeof data === "object") {
    return Object.keys(data)
      .map((key) => normalizeCountryName(key))
      .filter(Boolean);
  }

  return [];
};

const extractPvapinsCountries = (data) => {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => normalizeCountryName(item?.full_name || item?.name))
    .filter(Boolean);
};

const extractSmsPoolServices = (data) => {
  if (Array.isArray(data)) {
    return data
      .map((item) =>
        normalizeServiceKey(
          item?.name || item?.service || item?.label || item?.title || item
        )
      )
      .filter(Boolean);
  }

  if (data && typeof data === "object") {
    return Object.keys(data)
      .map((key) => normalizeServiceKey(key))
      .filter(Boolean);
  }

  return [];
};

const extractPvapinsServices = (data) => {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => normalizeServiceKey(item?.full_name || item?.name))
    .filter(Boolean);
};

export const getMergedCountries = async () => {
  const countryMap = new Map();

  const addCountry = (countryName, provider) => {
    const normalized = normalizeCountryName(countryName);

    if (!normalized) return;

    if (!countryMap.has(normalized)) {
      countryMap.set(normalized, {
        name: normalized,
        providers: []
      });
    }

    const entry = countryMap.get(normalized);

    if (!entry.providers.includes(provider)) {
      entry.providers.push(provider);
    }
  };

  const [smsPoolCountriesResult, pvapinsCountriesResult] =
    await Promise.allSettled([
      smsPoolProvider.getCountries?.(),
      pvapinsProvider.getCountries?.()
    ]);

  if (smsPoolCountriesResult.status === "fulfilled") {
    extractSmsPoolCountries(smsPoolCountriesResult.value).forEach((country) =>
      addCountry(country, "smspool")
    );
  }

  if (pvapinsCountriesResult.status === "fulfilled") {
    extractPvapinsCountries(pvapinsCountriesResult.value).forEach((country) =>
      addCountry(country, "pvapins")
    );
  }

  TIGER_SEEDED_COUNTRIES.forEach((country) => addCountry(country, "tiger"));

  return Array.from(countryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
};

const resolvePvapinsCountryId = async (countryName) => {
  const countries = await pvapinsProvider.getCountries();
  const normalizedWanted = normalizeCountryName(countryName);

  const match = Array.isArray(countries)
    ? countries.find(
        (item) =>
          normalizeCountryName(item?.full_name || item?.name) === normalizedWanted
      )
    : null;

  return match?.id || null;
};

export const getMergedServicesByCountry = async ({ country }) => {
  const serviceMap = new Map();

  const addService = (serviceKey, provider) => {
    const normalized = normalizeServiceKey(serviceKey);

    if (!normalized) return;

    if (!serviceMap.has(normalized)) {
      serviceMap.set(normalized, {
        id: normalized,
        name: normalized,
        providers: []
      });
    }

    const entry = serviceMap.get(normalized);

    if (!entry.providers.includes(provider)) {
      entry.providers.push(provider);
    }
  };

  const smsPoolServicesPromise = smsPoolProvider.getServices?.();

  let pvapinsServicesPromise = Promise.resolve([]);
  try {
    const pvapinsCountryId = await resolvePvapinsCountryId(country);
    if (pvapinsCountryId) {
      pvapinsServicesPromise = pvapinsProvider.getServices?.(pvapinsCountryId);
    }
  } catch (error) {
    pvapinsServicesPromise = Promise.resolve([]);
  }

  const [smsPoolServicesResult, pvapinsServicesResult] =
    await Promise.allSettled([smsPoolServicesPromise, pvapinsServicesPromise]);

  if (smsPoolServicesResult.status === "fulfilled") {
    extractSmsPoolServices(smsPoolServicesResult.value).forEach((service) =>
      addService(service, "smspool")
    );
  }

  if (pvapinsServicesResult.status === "fulfilled") {
    extractPvapinsServices(pvapinsServicesResult.value).forEach((service) =>
      addService(service, "pvapins")
    );
  }

  TIGER_SEEDED_SERVICES.forEach((service) => addService(service, "tiger"));

  return Array.from(serviceMap.values())
    .map((item) => ({
      ...item,
      displayName: prettifyServiceName(item.name)
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
};