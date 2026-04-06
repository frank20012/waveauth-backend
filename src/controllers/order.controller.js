export const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("user", "email firstName lastName")
      .populate("service", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      orders
    });
  } catch (error) {
    next(error);
  }
};