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
import subscriberRoutes from "./routes/subscriberRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import Order from "./models/Order.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "https://novapeptidelabs.org",
    methods: ["GET", "POST"]
  }
});

// Make io available inside routes
app.set("io", io);

io.on("connection", (socket) => {
  console.log("⚡ Client connected for live notifications");
});

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

    // TODO: update the corresponding order in MongoDB
    // mark order as paid and reduce inventory
  }

  res.json({ received: true });
});

/* ================= BASIC MIDDLEWARE ================= */

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

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
app.use("/api/subscribers", subscriberRoutes);
app.use("/api/newsletter", newsletterRoutes);

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

/* ================= SHIPPING RATES ================= */

app.post("/api/shipping/rates", async (req, res) => {
  try {
    if (!process.env.SHIPPO_API_KEY)
      return res.status(400).json({ message: "Shipping not active" });

    const { zip } = req.body;

    if (!zip)
      return res.status(400).json({ message: "ZIP code required" });

    const shipmentRes = await fetch(`${SHIPPO_API}/shipments/`, {
      method: "POST",
      headers: shippoHeaders,
      body: JSON.stringify({
        address_from: {
          name: "Nova Peptide Labs",
          street1: "6801 14th ave apt 1",
          city: "Brooklyn",
          state: "NY",
          zip: "11219",
          country: "US",
        },
        address_to: {
          zip: zip,
          country: "US",
        },
        parcels: [
          {
            length: "6",
            width: "4",
            height: "2",
            distance_unit: "in",
            weight: "0.5",
            mass_unit: "lb",
          },
        ],
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