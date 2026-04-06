import NumberInventory from "../models/NumberInventory.js";

export const createNumber = async (req, res, next) => {
  try {
    const { country, number, provider, serviceType, status } = req.body;

    if (!country || !number) {
      res.status(400);
      throw new Error("Country and number are required");
    }

    const existingNumber = await NumberInventory.findOne({ number });

    if (existingNumber) {
      res.status(400);
      throw new Error("Number already exists");
    }

    const newNumber = await NumberInventory.create({
      country,
      number,
      provider,
      serviceType,
      status
    });

    res.status(201).json({
      message: "Number added successfully",
      numberInventory: newNumber
    });
  } catch (error) {
    next(error);
  }
};

export const getAllNumbers = async (req, res, next) => {
  try {
    const numbers = await NumberInventory.find()
      .populate("assignedTo", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "All numbers fetched successfully",
      count: numbers.length,
      numbers
    });
  } catch (error) {
    next(error);
  }
};

export const getAvailableNumbers = async (req, res, next) => {
  try {
    const { country, serviceType } = req.query;

    const filter = { status: "available" };

    if (country) {
      filter.country = country;
    }

    if (serviceType) {
      filter.serviceType = serviceType;
    }

    const numbers = await NumberInventory.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Available numbers fetched successfully",
      count: numbers.length,
      numbers
    });
  } catch (error) {
    next(error);
  }
};