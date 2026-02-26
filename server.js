const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");
const path = require("path");
const paypal = require("@paypal/paypal-server-sdk");

const app = express();

/* ======================
   Middleware
====================== */
app.use(cors());
app.use(express.json());

// ✅ SERVE UPLOADS FOLDER
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath));

console.log("🔥 Uploads folder active at:", uploadsPath);

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
   PayPal Setup
====================== */

const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_SECRET
  )
);

/* ======================
   Models
====================== */
const Order = require("./models/Order");
const Product = require("./models/Product");

/* ======================
   Routes
====================== */

app.use("/api/stripe", require("./routes/stripe"));

// Root Route
app.get("/", (req, res) => {
  res.send("Nova Backend is live 🚀");
});

// Health Route
app.get("/api/health", (req, res) => {
  res.json({ message: "API is running" });
});

// GET ALL PRODUCTS
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
   STRIPE CHECKOUT
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
   PAYPAL CREATE ORDER
====================== */

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { cartItems } = req.body;

    const total = cartItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
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

    const order = await paypalClient.execute(request);

    res.json({ id: order.result.id });
  } catch (err) {
    console.error("PayPal create error:", err);
    res.status(500).json({ error: "PayPal order failed" });
  }
});

/* ======================
   PAYPAL CAPTURE ORDER
====================== */

app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderID, cartItems } = req.body;

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient.execute(request);

    await Order.create({
      email: capture.result.payer.email_address,
      items: cartItems,
      totalAmount:
        capture.result.purchase_units[0].amount.value,
      paypalOrderId: orderID,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({ error: "Capture failed" });
  }
});

/* ======================
   STRIPE WEBHOOK
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

      console.log("✅ Stripe Order saved");
    }

    res.json({ received: true });
  }
);

// Get All Orders
app.get("/api/orders", async (req, res) => {
  const adminKey = req.headers.authorization;

  if (adminKey !== process.env.ADMIN_SECRET) {
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