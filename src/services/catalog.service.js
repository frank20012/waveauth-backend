import { getAllProviders } from "./providerRegistry.js";
import {
  calculateSellingPriceNaira,
  convertProviderPriceToNgn
} from "../utils/pricing.js";

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");

const prettifyText = (value) =>
  String(value || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractCountryName = (country) => {
  if (typeof country === "string") return country;

  return (
    country?.name ||
    country?.full_name ||
    country?.country ||
    country?.label ||
    country?.code ||
    ""
  );
};

const extractCountryId = (country) => {
  if (typeof country === "string") return country;

  return (
    country?.providerCountryId ||
    country?.country_id ||
    country?.countryId ||
    country?.id ||
    country?.code ||
    country?.name ||
    ""
  );
};

const extractServiceName = (service) => {
  if (typeof service === "string") return service;

  return (
    service?.displayName ||
    service?.name ||
    service?.full_name ||
    service?.service ||
    service?.app ||
    service?.label ||
    ""
  );
};

const callProviderGetCountries = async (provider) => {
  if (typeof provider.getCountries !== "function") return [];

  const countries = await provider.getCountries();
  return Array.isArray(countries) ? countries : [];
};

const callProviderGetServices = async (provider, country) => {
  if (typeof provider.getServices !== "function") return [];

  try {
    const services = await provider.getServices({ country });
    return Array.isArray(services) ? services : [];
  } catch {
    const services = await provider.getServices(country);
    return Array.isArray(services) ? services : [];
  }
};

export const getUnifiedCountries = async () => {
  const providers = getAllProviders();

  const settledResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const countries = await callProviderGetCountries(provider);

      return countries
        .map((country) => {
          const name = String(extractCountryName(country)).trim();
          const providerCountryId = String(extractCountryId(country)).trim();

          if (!name) return null;

          return {
            provider: provider.name,
            providerCountryId,
            name: prettifyText(name),
            raw: country
          };
        })
        .filter(Boolean);
    })
  );

  const countryMap = new Map();

  settledResults.forEach((result, index) => {
    const provider = providers[index];

    if (result.status !== "fulfilled") {
      console.log(`${provider.name} country catalog failed:`, result.reason?.message);
      return;
    }

    result.value.forEach((country) => {
      const key = normalizeText(country.name);

      if (!key) return;

      const existing = countryMap.get(key);

      if (!existing) {
        countryMap.set(key, {
          name: country.name,
          label: country.name,
          value: country.name,
          providers: [
            {
              provider: country.provider,
              providerCountryId: country.providerCountryId
            }
          ]
        });

        return;
      }

      const alreadyExists = existing.providers.some(
        (item) => item.provider === country.provider
      );

      if (!alreadyExists) {
        existing.providers.push({
          provider: country.provider,
          providerCountryId: country.providerCountryId
        });
      }
    });
  });

  return [...countryMap.values()].sort((a, b) => a.name.localeCompare(b.name));
};

export const getUnifiedServicesByCountry = async (country) => {
  const providers = getAllProviders();

  const settledResults = await Promise.allSettled(
    providers.map(async (provider) => {
      const services = await callProviderGetServices(provider, country);

      return services
        .map((service) => {
          const name = String(extractServiceName(service)).trim();

          if (!name) return null;

          return {
            provider: provider.name,
            providerServiceId:
              service?.providerServiceId ||
              service?.service_id ||
              service?.serviceId ||
              service?.id ||
              name,
            name,
            displayName: prettifyText(name),
            raw: service
          };
        })
        .filter(Boolean);
    })
  );

  const serviceMap = new Map();

  settledResults.forEach((result, index) => {
    const provider = providers[index];

    if (result.status !== "fulfilled") {
      console.log(`${provider.name} service catalog failed:`, result.reason?.message);
      return;
    }

    result.value.forEach((service) => {
      const key = normalizeText(service.name);

      if (!key) return;

      const existing = serviceMap.get(key);

      if (!existing) {
        serviceMap.set(key, {
          name: service.name,
          displayName: service.displayName,
          providers: [
            {
              provider: service.provider,
              providerServiceId: service.providerServiceId
            }
          ]
        });

        return;
      }

      const alreadyExists = existing.providers.some(
        (item) => item.provider === service.provider
      );

      if (!alreadyExists) {
        existing.providers.push({
          provider: service.provider,
          providerServiceId: service.providerServiceId
        });
      }
    });
  });

  return [...serviceMap.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
};

export const getUnifiedServicePricing = async ({
  country,
  service,
  type = "temporary"
}) => {
  const providers = getAllProviders();

  const results = await Promise.allSettled(
    providers.map(async (provider) => {
      const priceData = await provider.getPrice({ country, service, type });

      const providerPrice = Number(priceData?.providerPrice || 0);
      const providerCurrency = String(
        priceData?.providerCurrency || "USD"
      ).toUpperCase();
      const stock = Number(priceData?.stock || 0);
      const hasValidPrice = providerPrice > 0;

      return {
        provider: provider.name,
        country,
        service,
        type,
        providerPrice,
        providerCurrency,
        stock,
        hasValidPrice,
        basePriceNgn: hasValidPrice
          ? await convertProviderPriceToNgn(providerPrice, providerCurrency)
          : 0,
        sellingPriceNgn: hasValidPrice
          ? await calculateSellingPriceNaira(providerPrice, providerCurrency)
          : 0,
        raw: priceData?.raw || null
      };
    })
  );

  const normalizedResults = results.map((result, index) => {
    const provider = providers[index];

    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      provider: provider.name,
      country,
      service,
      type,
      providerPrice: 0,
      providerCurrency: "USD",
      stock: 0,
      hasValidPrice: false,
      basePriceNgn: 0,
      sellingPriceNgn: 0,
      raw: null,
      error: result.reason?.message || "Failed to fetch provider pricing"
    };
  });

  return normalizedResults.sort((a, b) => {
    const aAvailable = Number(a.stock || 0) > 0;
    const bAvailable = Number(b.stock || 0) > 0;

    if (aAvailable && !bAvailable) return -1;
    if (!aAvailable && bAvailable) return 1;

    const aPriced = Boolean(a.hasValidPrice);
    const bPriced = Boolean(b.hasValidPrice);

    if (aPriced && !bPriced) return -1;
    if (!aPriced && bPriced) return 1;

    return Number(a.sellingPriceNgn || 0) - Number(b.sellingPriceNgn || 0);
  });
};

export const getBestProviderForService = async ({
  country,
  service,
  type = "temporary"
}) => {
  const pricing = await getUnifiedServicePricing({
    country,
    service,
    type
  });

  return (
    pricing.find(
      (item) =>
        !item.error &&
        Number(item.stock || 0) > 0 &&
        Boolean(item.hasValidPrice)
    ) || null
  );
};