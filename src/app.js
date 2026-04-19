import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import orderRoutes from "./routes/otp.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import otpOrderRoutes from "./routes/otpOrder.routes.js";
import numberInventoryRoutes from "./routes/numberInventory.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import rentRoutes from "./routes/rent.routes.js";
import providerDebugRoutes from "./routes/providerDebug.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";

import notFound from "./middlewares/notfound.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.status(200).json({
    message: "WaveAuth backend is running"
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
app.use("/api/otp-orders", otpOrderRoutes);
app.use("/api/numbers", numberInventoryRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/rent", rentRoutes);
app.use("/api/provider-debug", providerDebugRoutes);
app.use("/api/catalog", catalogRoutes);

console.log("Routes loaded: /api/services, /api/otp, /api/rent");

app.use(notFound);
app.use(errorHandler);

export default app;