require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");
const path = require("path");

const {
  PayPalHttpClient,
  LiveEnvironment,
  OrdersController,
} = require("@paypal/paypal-server-sdk");

const app = express();

/* ======================
   Middleware
====================== */
app.use(cors());
app.use(express.json());

const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

console.log("🔥 Uploads folder active at:", uploadsPath);

/* ======================
   Database
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
   PayPal Setup (LIVE)
====================== */
const environment = new LiveEnvironment(
  process.env.PAYPAL_CLIENT_ID,
  process.env.PAYPAL_SECRET
);

const paypalClient = new PayPalHttpClient(environment);
const ordersController = new OrdersController(paypalClient);

/* ======================
   Models
====================== */
const Order = require("./models/Order");
const Product = require("./models/Product");

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
    console.error("Products error:", err);
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
    console.error("Stripe error:", err);
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

    const order = await ordersController.createOrder({
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: total.toFixed(2),
            },
          },
        ],
      },
    });

    res.json({ id: order.result.id });
  } catch (err) {
    console.error("PayPal create error:", err);
    res.status(500).json({ error: "PayPal create failed" });
  }
});

/* ======================
   PayPal Capture
====================== */
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, cartItems } = req.body;

    const capture = await ordersController.captureOrder({
      id: orderID,
    });

    await Order.create({
      email: capture.result.payer.email_address,
      items: cartItems,
      totalAmount:
        capture.result.purchase_units[0].payments.captures[0].amount.value,
      paypalOrderId: orderID,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({ error: "Capture failed" });
  }
});

/* ======================
   Admin Orders
====================== */
app.get("/api/orders", async (req, res) => {
  if (req.headers.authorization !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

/* ======================
   Start Server
====================== */
const PORT = process.env.PORT || 5001;

app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);