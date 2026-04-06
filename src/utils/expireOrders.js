import OtpOrder from "../models/OtpOrder.js";
import NumberInventory from "../models/NumberInventory.js";

export const expireOrderIfNeeded = async (order) => {
  if (!order) return order;

  const now = new Date();

  if (
    order.status === "active" &&
    order.expiresAt &&
    new Date(order.expiresAt) <= now
  ) {
    order.status = "expired";
    await order.save();

    const number = await NumberInventory.findById(order.numberInventory);
    if (number) {
      number.status = "available";
      number.assignedTo = null;
      await number.save();
    }
  }

  return order;
};

export const expireManyOrdersIfNeeded = async (orders = []) => {
  const updatedOrders = [];

  for (const order of orders) {
    const updatedOrder = await expireOrderIfNeeded(order);
    updatedOrders.push(updatedOrder);
  }

  return updatedOrders;
};