import Service from "../models/service.js";

export const getServices = async (req, res, next) => {
  try {
    const services = await Service.find({ status: "active" }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Services fetched successfully",
      count: services.length,
      services
    });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const {
      name,
      serviceCode,
      country,
      category,
      price,
      deliveryType,
      status,
      description
    } = req.body;

    if (!name || !serviceCode || !country || price === undefined) {
      res.status(400);
      throw new Error("Name, serviceCode, country, and price are required");
    }

    const existingService = await Service.findOne({
      serviceCode: serviceCode.toLowerCase(),
      country
    });

    if (existingService) {
      res.status(400);
      throw new Error("Service already exists for this country");
    }

    const service = await Service.create({
      name,
      serviceCode,
      country,
      category,
      price,
      deliveryType,
      status,
      description
    });

    res.status(201).json({
      message: "Service created successfully",
      service
    });
  } catch (error) {
    next(error);
  }
};

export const getAllServicesForAdmin = async (req, res, next) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });

    res.status(200).json({
      message: "Admin services fetched successfully",
      count: services.length,
      services
    });
  } catch (error) {
    next(error);
  }
};