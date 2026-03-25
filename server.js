import dotenv from "dotenv";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";

import rateLimit from "express-rate-limit";
import Stripe from "stripe";

import http from "http";
import { Server } from "socket.io";


import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/authRoutes.js";
import subscriberRoutes from "./routes/subscriberRoutes.js";
import emailRoutes from "./routes/emailRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import restockRoutes from "./routes/restockRoutes.js";
import Order from "./models/Order.js";
import Product from "./models/Product.js";
import {
  sendAdminOrderNotification,
  sendOrderConfirmationEmail,
} from "./utils/sendEmail.js";
import { createShippoLabel } from "./utils/createShippoLabel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

const server = http.createServer(app);

const allowedOrigins = [
  "https://novapeptidelabs.org",
  "https://www.novapeptidelabs.org"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available inside routes
app.set("io", io);

io.on("connection", (socket) => {
  console.log("⚡ Client connected for live notifications");
});

const emitPurchaseEvent = (order) => {
  try {
    const firstItem = order.items?.[0];

    io.emit("purchase", {
      product: firstItem?.name || "Research Compound",
      location: "USA",
      time: new Date(),
    });

    io.emit("new-order", order);
  } catch (err) {
    console.error("Socket emit failed:", err);
  }
};

const hasCompleteShippingAddress = (shippingAddress = {}) => {
  return Boolean(
    shippingAddress.name &&
    shippingAddress.street &&
    shippingAddress.city &&
    shippingAddress.state &&
    shippingAddress.zip
  );
};

/* ================= STRIPE WEBHOOK ================= */

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("💰 Stripe payment completed:", session.id);

    try {
      const order = await Order.findOne({ stripeSessionId: session.id });

      if (!order) {
        console.warn("Stripe order not found for session:", session.id);
        return res.json({ received: true });
      }

      if (order.isPaid) {
        return res.json({ received: true });
      }

      order.isPaid = true;
      order.status = "paid";
      order.paidAt = new Date();

      for (const item of order.items) {
        const product = await Product.findById(item.product);

        if (!product) continue;

        product.stock -= item.quantity;
        if (product.stock < 0) product.stock = 0;

        await product.save();
      }

      await order.save();

      if (hasCompleteShippingAddress(order.shippingAddress) && !order.shippingLabelUrl) {
        const shipment = await createShippoLabel(order);

        if (shipment) {
          order.shippingLabelUrl = shipment.labelUrl;
          order.trackingNumber = shipment.trackingNumber;
          await order.save();
        }
      }

      const orderEmail = order.email || order.customerEmail;

      try {
        if (orderEmail) {
          await sendOrderConfirmationEmail(order, orderEmail);
        }

        await sendAdminOrderNotification(order);
      } catch (mailErr) {
        console.error("Stripe webhook email notification error:", mailErr);
      }

      emitPurchaseEvent(order);
    } catch (err) {
      console.error("Stripe webhook processing error:", err);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  }

  res.json({ received: true });
});

/* ================= BASIC MIDDLEWARE ================= */

app.use(express.json());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please wait a few minutes and try again."
  },
  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json(options.message);
  }
}));

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/* ================= ROUTES ================= */

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/subscribers", subscriberRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/restock", restockRoutes);

/* ================= ADMIN ANALYTICS ================= */

app.get("/api/admin/analytics", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await Order.find({ createdAt: { $gte: today } });
    const allOrders = await Order.find();

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    res.json({
      todayOrders: todayOrders.length,
      totalOrders: allOrders.length,
      todayRevenue,
      totalRevenue
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Analytics failed" });
  }
});

/* ================= SHIPPO CONFIG ================= */

const SHIPPO_API = "https://api.goshippo.com";

const shippoHeaders = {
  Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
  "Content-Type": "application/json",
};

const buildRateAddress = (shippingAddress = {}) => ({
  name: shippingAddress.name || "Customer",
  street1: shippingAddress.street || shippingAddress.address || undefined,
  city: shippingAddress.city || undefined,
  state: shippingAddress.state || undefined,
  zip: shippingAddress.zip || shippingAddress.postalCode || undefined,
  country: shippingAddress.country || "US",
});

const buildEstimatedParcel = (items = []) => {
  const totalUnits = Array.isArray(items)
    ? items.reduce((sum, item) => sum + Math.max(Number(item.quantity) || 0, 0), 0)
    : 0;

  const safeUnits = Math.max(totalUnits, 1);

  return {
    length: safeUnits >= 6 ? "8" : safeUnits >= 3 ? "7" : "6",
    width: safeUnits >= 6 ? "6" : "4",
    height: safeUnits >= 6 ? "4" : safeUnits >= 3 ? "3" : "2",
    distance_unit: "in",
    weight: (0.35 + safeUnits * 0.18).toFixed(2),
    mass_unit: "lb",
  };
};

/* ================= SHIPPING RATES ================= */

app.post("/api/shipping/rates", async (req, res) => {
  try {
    if (!process.env.SHIPPO_API_KEY)
      return res.status(400).json({ message: "Shipping not active" });

    const { zip, shippingAddress, items } = req.body;
    const addressTo = buildRateAddress({
      ...(shippingAddress || {}),
      zip: shippingAddress?.zip || zip,
    });

    if (!addressTo.zip)
      return res.status(400).json({ message: "ZIP code required" });

    const shipmentRes = await fetch(`${SHIPPO_API}/shipments/`, {
      method: "POST",
      headers: shippoHeaders,
      body: JSON.stringify({
        address_from: {
          name: "Hansel Crousset",
          street1: "5504 13th Ave #1013",
          city: "Brooklyn",
          state: "NY",
          zip: "11219",
          country: "US",
        },
        address_to: addressTo,
        parcels: [buildEstimatedParcel(items)],
        async: false,
      }),
    });

    const shipment = await shipmentRes.json();

    if (!shipment.rates) return res.json([]);

    const cleanedRates = shipment.rates
      .filter((rate) => rate.amount && rate.provider)
      .sort((a, b) => Number(a.amount) - Number(b.amount))
      .slice(0, 3)
      .map((rate) => ({
        provider: rate.provider,
        service: rate.servicelevel?.name || "Shipping",
        price: rate.amount,
        estimated_days: rate.estimated_days || null,
        rateId: rate.object_id,
      }));

    res.json(cleanedRates);
  } catch (err) {
    console.error("Shipping rate error:", err);
    res.status(500).json({ message: "Failed to fetch shipping rates" });
  }
});

/* ================= HEALTH CHECK ================= */

app.get("/", (req, res) => {
  res.send("Nova Backend Running");
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 5050;

server.listen(PORT, () => {
  console.log(`🚀 Backend running with realtime notifications on port ${PORT}`);
});
