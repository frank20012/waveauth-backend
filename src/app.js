import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import orderRoutes from "./routes/otp.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import adminRoutes from "./routes/admin.routes.js"
import numberInventoryRoutes from "./routes/numberInventory.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import rentRoutes from "./routes/rent.routes.js";
import providerDebugRoutes from "./routes/providerDebug.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";

import notFound from "./middlewares/notfound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";

const app = express();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: {
    success: false,
    message: "Too many requests. Try again later."
  }
});


app.use(limiter);
app.use(
  cors({
    origin: [
      "https://deskotp.com",
      "https://www.deskotp.com",
      "http://localhost:5501",
      "http://127.0.0.1:5501"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

// app.options("*", cors());
app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "DESKOTP backend running"
  });
});

app.get("/", (req, res) => {
  res.status(200).json({
    message: "DESKOTP backend is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/numbers", numberInventoryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/rent", rentRoutes);
app.use("/api/provider-debug", providerDebugRoutes);
app.use("/api/catalog", catalogRoutes);

console.log("Routes loaded: /api/services, /api/otp, /api/rent");

app.use(notFound);
app.use(errorHandler);

export default app;