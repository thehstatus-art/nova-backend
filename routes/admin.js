const express = require("express");
const jwt = require("jsonwebtoken");
const Order = require("../models/Order");
const Subscriber = require("../models/Subscriber");
const { sendEmail } = require("../utils/sendEmail");
const shippo = require("shippo")(process.env.SHIPPO_API_KEY);

const router = express.Router();

function protect(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

router.get("/orders", protect, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("items.product", "name price image")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    console.error("Admin fetch orders error:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

router.put("/orders/:id/status", protect, async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    order.status = status;

    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

router.put("/orders/:id/shipping", protect, async (req, res) => {
  try {
    const { trackingNumber, shippingLabelUrl } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    order.trackingNumber = trackingNumber;
    order.shippingLabelUrl = shippingLabelUrl;
    order.status = "shipped";

    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Attach shipping label error:", err);
    res.status(500).json({ message: "Failed to attach shipping info" });
  }
});

router.post("/orders/:id/create-label", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("items.product");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const shipment = await shippo.shipment.create({
      address_from: {
        name: "Nova Peptide Labs",
        street1: "Fulfillment Center",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US"
      },
      address_to: order.shippingAddress,
      parcels: [
        {
          length: "6",
          width: "6",
          height: "4",
          distance_unit: "in",
          weight: "1",
          mass_unit: "lb"
        }
      ],
      async: false
    });

    const rate = shipment.rates[0];

    const transaction = await shippo.transaction.create({
      rate: rate.object_id,
      label_file_type: "PDF"
    });

    order.trackingNumber = transaction.tracking_number;
    order.shippingLabelUrl = transaction.label_url;
    order.status = "shipped";

    await order.save();

    res.json({
      message: "Shipping label created",
      tracking: transaction.tracking_number,
      label: transaction.label_url
    });
  } catch (err) {
    console.error("Shippo label error:", err);
    res.status(500).json({ message: "Failed to create shipping label" });
  }
});


/* =========================================
   BULK SHIPPING LABEL CREATION
========================================= */

router.post("/orders/bulk-labels", protect, async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds)) {
      return res.status(400).json({ message: "orderIds array required" });
    }

    const orders = await Order.find({ _id: { $in: orderIds } });

    const results = [];

    for (const order of orders) {
      try {

        const shipment = await shippo.shipment.create({
          address_from: {
            name: "Nova Peptide Labs",
            street1: "Fulfillment Center",
            city: "New York",
            state: "NY",
            zip: "10001",
            country: "US"
          },
          address_to: order.shippingAddress,
          parcels: [{
            length: "6",
            width: "6",
            height: "4",
            distance_unit: "in",
            weight: "1",
            mass_unit: "lb"
          }],
          async: false
        });

        const rate = shipment.rates[0];

        const transaction = await shippo.transaction.create({
          rate: rate.object_id,
          label_file_type: "PDF"
        });

        order.trackingNumber = transaction.tracking_number;
        order.shippingLabelUrl = transaction.label_url;
        order.status = "shipped";

        await order.save();

        results.push({
          orderId: order._id,
          tracking: transaction.tracking_number,
          label: transaction.label_url
        });

      } catch (err) {
        results.push({
          orderId: order._id,
          error: err.message
        });
      }
    }

    res.json({
      message: "Bulk label generation complete",
      results
    });

  } catch (err) {
    console.error("Bulk shipping error:", err);
    res.status(500).json({ message: "Bulk shipping failed" });
  }
});

/* =========================================
   MARK ORDER DELIVERED
========================================= */

router.put("/orders/:id/delivered", protect, async (req, res) => {
  try {

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    order.status = "delivered";
    order.deliveredAt = new Date();

    await order.save();

    res.json(order);

  } catch (err) {
    console.error("Mark delivered error:", err);
    res.status(500).json({ message: "Failed to update delivery status" });
  }
});

router.get("/analytics", protect, async (req, res) => {
  const orders = await Order.find();

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || o.total || 0), 0);

  res.json({
    totalRevenue,
    totalOrders: orders.length,
  });
});


/* =========================================
   GET SHIPPING LABEL
========================================= */

router.get("/orders/:id/label", protect, async (req, res) => {
  try {

    const order = await Order.findById(req.params.id);

    if (!order)
      return res.status(404).json({ message: "Order not found" });

    if (!order.shippingLabelUrl)
      return res.status(404).json({ message: "Label not created yet" });

    res.json({
      label: order.shippingLabelUrl,
      tracking: order.trackingNumber
    });

  } catch (err) {
    console.error("Fetch label error:", err);
    res.status(500).json({ message: "Failed to fetch label" });
  }
});

/* =========================================
   SEND NEWSLETTER TO ALL SUBSCRIBERS
========================================= */

router.post("/newsletter/send", protect, async (req, res) => {
  try {

    const subscribers = await Subscriber.find();

    if (!subscribers.length) {
      return res.json({ message: "No subscribers found" });
    }

    for (const sub of subscribers) {

      await sendEmail({
        to: sub.email,
        subject: "Nova Research Network Update",
        html: `
          <div style="font-family:Arial;padding:30px">

            <h2>Nova Peptide Labs Research Network</h2>

            <p>
            New research compounds and verified batches are now available.
            Visit the research catalog to explore the latest releases.
            </p>

            <a href="https://novapeptidelabs.org/shop"
            style="background:#0ea5e9;color:white;padding:14px 22px;text-decoration:none;border-radius:6px">
            View Research Catalog
            </a>

            <p style="margin-top:20px;font-size:12px;color:#888">
            You are receiving this because you joined the Nova Research Network.
            </p>

          </div>
        `
      });

    }

    res.json({ message: `Newsletter sent to ${subscribers.length} subscribers` });

  } catch (err) {
    console.error("Newsletter send error:", err);
    res.status(500).json({ message: "Failed to send newsletter" });
  }
});

module.exports = router;
