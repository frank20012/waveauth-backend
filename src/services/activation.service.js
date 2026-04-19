import { getProvider, getProviderPriority } from "./providerRegistry.js";
import { calculateSellingPriceNaira } from "../utils/pricing.js";
import OtpOrder from "../models/OtpOrder.js";

const convertUsdToNgn = (amount) => {
  const rate = Number(process.env.USD_TO_NGN || 1600);
  return Number(amount || 0) * rate;
};

const buildSellingPrice = async (providerPrice, providerCurrency = "USD") => {
  const numericPrice = Number(providerPrice || 0);
  const normalizedCurrency = String(providerCurrency || "USD").toUpperCase();

  if (typeof calculateSellingPriceNaira === "function") {
    return await calculateSellingPriceNaira(numericPrice, normalizedCurrency);
  }

  const basePriceNgn =
    normalizedCurrency === "USD"
      ? convertUsdToNgn(numericPrice)
      : Math.ceil(numericPrice);

  const markupPercent = Number(process.env.DEFAULT_MARKUP_PERCENT || 25);
  const flatMarkupNgn = Number(process.env.DEFAULT_FLAT_MARKUP_NGN || 500);

  return Math.ceil(
    basePriceNgn + (basePriceNgn * markupPercent) / 100 + flatMarkupNgn
  );
};

export const buyTemporaryActivation = async ({
  userId,
  country,
  service,
  operator
}) => {
  const providerNames = getProviderPriority("temporary");
  const errors = [];

  for (const providerName of providerNames) {
    const provider = getProvider(providerName);

    if (!provider) continue;

    try {
      const priceInfo = await provider.getPrice({
        country,
        service,
        type: "temporary"
      });

      if (Number(priceInfo?.stock || 0) <= 0) {
        errors.push(`${providerName}: no stock`);
        continue;
      }

      const purchase = await provider.buyTemporaryNumber({
        country,
        service,
        operator
      });

      const liveProviderCost =
        Number(purchase?.raw?.cost) ||
        Number(purchase?.raw?.price) ||
        Number(priceInfo?.providerPrice || 0);

      const liveProviderCurrency = String(
        purchase?.raw?.currency ||
          priceInfo?.providerCurrency ||
          "USD"
      ).toUpperCase();

      const finalSellingPrice = await buildSellingPrice(
        liveProviderCost,
        liveProviderCurrency
      );

      const orderData = {
        user: userId,
        serviceName: service,
        country,
        assignedNumber: String(purchase.phoneNumber || ""),
        otpCode: "",
        price: Number(finalSellingPrice || 0),
        provider: providerName,
        providerOrderId: String(purchase.providerOrderId || ""),
        providerOperator: purchase?.raw?.operator || operator || "any",
        providerCost: Number(liveProviderCost || 0),
        rawProviderResponse: purchase.raw || {},
        status: "pending"
      };

      const order = await OtpOrder.create(orderData);
      return order;
    } catch (error) {
      errors.push(`${providerName}: ${error.message}`);
    }
  }

  throw new Error(
    `No provider could supply this temporary number. ${errors.join(" | ")}`
  );
};

export const checkTemporaryActivationOtp = async (orderId) => {
  const order = await OtpOrder.findById(orderId);

  if (!order) {
    throw new Error("OTP order not found");
  }

  const provider = getProvider(order.provider);

  if (!provider) {
    throw new Error(`Provider not found: ${order.provider}`);
  }

  const result = await provider.checkSms({
    providerOrderId: order.providerOrderId,
    phoneNumber: order.assignedNumber,
    country: order.country,
    service: order.serviceName,
    operator: order.providerOperator
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

export const cancelTemporaryActivation = async (orderId) => {
  const order = await OtpOrder.findById(orderId);

  if (!order) {
    throw new Error("OTP order not found");
  }

  const provider = getProvider(order.provider);

  if (!provider) {
    throw new Error(`Provider not found: ${order.provider}`);
  }

  const result = await provider.cancel({
    providerOrderId: order.providerOrderId,
    phoneNumber: order.assignedNumber,
    country: order.country,
    service: order.serviceName,
    operator: order.providerOperator
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