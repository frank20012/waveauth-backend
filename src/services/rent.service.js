import { getProvider, getProviderPriority } from "./providerRegistry.js";
import { calculateSellingPriceNaira } from "../utils/pricing.js";
import RentOrder from "../models/RentOrder.js";

const convertUsdToNgn = (amount) => {
  const rate = Number(process.env.USD_TO_NGN || 1600);
  return Number(amount || 0) * rate;
};

const buildSellingPrice = (providerPriceUsd) => {
  const priceUsd = Number(providerPriceUsd || 0);

  if (typeof calculateSellingPriceNaira === "function") {
    return calculateSellingPriceNaira(priceUsd);
  }

  const basePriceNgn = convertUsdToNgn(priceUsd);
  const markupPercent = Number(process.env.DEFAULT_MARKUP_PERCENT || 25);
  const flatMarkupNgn = Number(process.env.DEFAULT_FLAT_MARKUP_NGN || 500);

  return Math.ceil(
    basePriceNgn + (basePriceNgn * markupPercent) / 100 + flatMarkupNgn
  );
};

export const buyRentalActivation = async ({
  userId,
  country,
  service,
  operator
}) => {
  const providerNames = getProviderPriority("rental");
  const errors = [];

  for (const providerName of providerNames) {
    const provider = getProvider(providerName);

    if (!provider) continue;

    try {
      const priceInfo = await provider.getPrice({
        country,
        service,
        type: "rental"
      });

      if (Number(priceInfo?.stock || 0) <= 0) {
        errors.push(`${providerName}: no stock`);
        continue;
      }

      const purchase = await provider.buyRentalNumber({
        country,
        service,
        operator
      });

      const orderData = {
        user: userId,
        country,
        serviceName: service,
        serviceId: service,
        countryId: country,
        provider: providerName,
        providerOrderId: String(purchase.providerOrderId || ""),
        assignedNumber: purchase.phoneNumber,
        otpCode: "",
        providerCostUsd: Number(priceInfo.providerPriceUsd || 0),
        rawProviderResponse: purchase.raw || {},
        price: buildSellingPrice(priceInfo.providerPriceUsd || 0),
        status: "active"
      };

      const order = await RentOrder.create(orderData);
      return order;
    } catch (error) {
      errors.push(`${providerName}: ${error.message}`);
    }
  }

  throw new Error(
    `No provider could supply this rental number. ${errors.join(" | ")}`
  );
};

export const checkRentalActivationOtp = async (orderId) => {
  const order = await RentOrder.findById(orderId);

  if (!order) {
    throw new Error("Rent order not found");
  }

  const provider = getProvider(order.provider);

  if (!provider) {
    throw new Error(`Provider not found: ${order.provider}`);
  }

  const result = await provider.checkSms({
    providerOrderId: order.providerOrderId,
    phoneNumber: order.assignedNumber,
    country: order.countryId || order.country,
    service: order.serviceId || order.serviceName,
    operator: "any"
  });

  order.otpCode = result.otpCode || order.otpCode || "";
  order.rawProviderResponse = result.raw || order.rawProviderResponse || {};

  if (result.status === "otp_received") {
    order.status = "completed";
  } else if (result.status === "cancelled") {
    order.status = "cancelled";
  } else if (result.status) {
    order.status = "active";
  }

  await order.save();
  return order;
};

export const cancelRentalActivation = async (orderId) => {
  const order = await RentOrder.findById(orderId);

  if (!order) {
    throw new Error("Rent order not found");
  }

  const provider = getProvider(order.provider);

  if (!provider) {
    throw new Error(`Provider not found: ${order.provider}`);
  }

  const result = await provider.cancel({
    providerOrderId: order.providerOrderId,
    phoneNumber: order.assignedNumber,
    country: order.countryId || order.country,
    service: order.serviceId || order.serviceName,
    operator: "any"
  });

  if (result.success) {
    order.status = "cancelled";
    order.rawProviderResponse = result.raw || order.rawProviderResponse || {};
    await order.save();
  }

  return {
    order,
    providerResult: result
  };
};