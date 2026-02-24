require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

/* ======================
   Middleware
====================== */
app.use(cors());
app.use(express.json());

/* ======================
   MongoDB Connection
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
   Order Model
====================== */
const Order = require("./models/Order");

/* ======================
   Routes
====================== */

// Root Route
app.get("/", (req, res) => {
  res.send("Nova Backend is live 🚀");
});

// Health Route
app.get("/api/health", (req, res) => {
  res.json({ message: "API is running" });
});

/* ======================
   Stripe Checkout Route
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
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        items: JSON.stringify(cartItems),
      },
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
   Stripe Webhook
====================== */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      await Order.create({
        email: session.customer_details.email,
        items: JSON.parse(session.metadata.items),
        totalAmount: session.amount_total / 100,
        stripeSessionId: session.id,
      });

      console.log("✅ Order saved to MongoDB");
    }

    res.json({ received: true });
  }
);

/* ======================
   Get All Orders (Admin)
====================== */
app.get("/api/orders", async (req, res) => {
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