import Ticket from "../models/Ticket.js";

export const createTicket = async (req, res, next) => {
  try {
    const { subject, message, category } = req.body;

    if (!subject || !message) {
      res.status(400);
      throw new Error("Subject and message are required");
    }

    const ticket = await Ticket.create({
      user: req.user._id,
      subject: subject.trim(),
      message: message.trim(),
      category: category || "general"
    });

    res.status(201).json({
      message: "Ticket created successfully",
      ticket
    });
  } catch (error) {
    next(error);
  }
};

export const getMyTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Your tickets fetched successfully",
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTickets = async (req, res, next) => {
  try {
    const tickets = await Ticket.find()
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Admin tickets fetched successfully",
      count: tickets.length,
      tickets
    });
  } catch (error) {
    next(error);
  }
};

export const updateTicket = async (req, res, next) => {
  try {
    const { status, adminReply } = req.body;

    const ticket = await Ticket.findById(req.params.id).populate(
      "user",
      "firstName lastName email"
    );

    if (!ticket) {
      res.status(404);
      throw new Error("Ticket not found");
    }

    const allowedStatuses = ["open", "review", "resolved"];

    if (status && !allowedStatuses.includes(status)) {
      res.status(400);
      throw new Error("Invalid ticket status");
    }

    if (status) {
      ticket.status = status;
    }

    if (adminReply !== undefined) {
      ticket.adminReply = adminReply.trim();
    }

    await ticket.save();

    res.status(200).json({
      message: "Ticket updated successfully",
      ticket
    });
  } catch (error) {
    next(error);
  }
};