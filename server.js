import productRoutes from './routes/productRoutes.js';
app.use('/api/products', productRoutes);
import orderRoutes from './routes/orderRoutes.js';
app.use('/api/orders', orderRoutes);
const batchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
});
app.use('/api/batch', batchLimiter);
import batchRoutes from './routes/batchRoutes.js';
app.use('/api/batch', batchRoutes);
app.use('/api/batch', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
}));
// Login Route Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});
app.use('/api/auth/login', authLimiter);
// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per window
});
app.use(limiter);
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
// ...existing code...
// ...existing code...
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
console.log("CLIENT ID LENGTH:", process.env.PAYPAL_CLIENT_ID?.length);
console.log("SECRET LENGTH:", process.env.PAYPAL_SECRET?.length);
console.log("CLIENT ID START:", process.env.PAYPAL_CLIENT_ID?.slice(0,6));
console.log("SECRET START:", process.env.PAYPAL_SECRET?.slice(0,6));
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");
const path = require("path");
const paypal = require("@paypal/checkout-server-sdk");

const app = express();


/* ======================
  Security Middleware
====================== */
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

console.log("🔥 Uploads folder active at:", uploadsPath);

/* ======================
   MongoDB
====================== */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("Mongo error:", err));

/* ======================
   Stripe Setup
====================== */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ======================
   PayPal Setup
====================== */
function environment() {
  return new paypal.core.LiveEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_SECRET
  );
}

function client() {
  return new paypal.core.PayPalHttpClient(environment());
}

/* ======================
   Models
====================== */
const Order = require("./models/Order");
const Product = require("./models/Product");
const { auth, admin, protect, protectAdmin } = require("./middleware/auth");
// Admin: Get all orders
app.get("/api/admin/orders", protect || auth, protectAdmin || admin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});
/* ADMIN CREATE PRODUCT */
app.post("/api/admin/products", auth, admin, async (req, res) => {
  try {
    let body = { ...req.body };
    // Auto-generate batchNumber if not provided
    if (!body.batchNumber) {
      // Example: NP-RET-2402-A
      const BRAND = "NP"; // Change as needed
      const PRODUCTCODE = (body.slug || body.name || "PROD").substring(0,3).toUpperCase();
      const now = new Date();
      const YEAR = String(now.getFullYear()).slice(-2);
      const MONTH = (now.getMonth() + 1).toString().padStart(2, '0');
      const LETTER = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      body.batchNumber = `${BRAND}-${PRODUCTCODE}-${YEAR}${MONTH}-${LETTER}`;
    }
    const product = await Product.create(body);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

/* ADMIN DELETE PRODUCT */
app.delete("/api/admin/products/:id", auth, admin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ======================
   Basic Routes
====================== */
app.get("/", (req, res) => {
  res.send("Nova Backend is live 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({ message: "API running" });
});

/* ======================
   Products
====================== */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/* ======================
   Stripe Checkout
====================== */
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { cartItems } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: cartItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      success_url: process.env.FRONTEND_URL + "/success",
      cancel_url: process.env.FRONTEND_URL + "/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe session failed" });
  }
});

/* ======================
   PayPal Create Order
====================== */
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { cartItems } = req.body;

    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const request = new paypal.orders.OrdersCreateRequest();

    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: total.toFixed(2),
          },
        },
      ],
    });

    const order = await client().execute(request);

    res.json({ id: order.result.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PayPal create failed" });
  }
});

/* ======================
   PayPal Capture
====================== */
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, cartItems } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await client().execute(request);

    await Order.create({
      email: capture.result.payer.email_address,
      items: cartItems,
      totalAmount:
        capture.result.purchase_units[0].payments.captures[0].amount.value,
      paypalOrderId: orderID,
    });

    // Decrement stock for each product
    for (const item of cartItems) {
      await Product.findByIdAndUpdate(item._id, { $inc: { stock: -item.quantity } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Capture failed" });
  }
});

/* ======================
   Start Server
====================== */
const PORT = process.env.PORT || 5001;

app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);