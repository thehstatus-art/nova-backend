import express from "express";
import fetch from "node-fetch";
import Order from "../models/Order.js";
import Subscriber from "../models/Subscriber.js";
import { protect, isAdmin } from "../middleware/auth.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();
const SHIPPO_API = "https://api.goshippo.com";

const createShippoTransaction = async (shippingAddress = {}) => {
  const shipmentRes = await fetch(`${SHIPPO_API}/shipments/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address_from: {
        name: "NovaPeptideLabs",
        street1: "5504 13th Ave #1013",
        city: "Brooklyn",
        state: "NY",
        zip: "11219",
        country: "US",
      },
      address_to: {
        name: shippingAddress.name,
        street1: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zip: shippingAddress.zip,
        country: shippingAddress.country || "US",
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

  if (!shipment?.rates?.length) {
    throw new Error("No shipping rates returned from Shippo");
  }

  const transactionRes = await fetch(`${SHIPPO_API}/transactions/`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rate: shipment.rates[0].object_id,
      label_file_type: "PDF",
    }),
  });

  const transaction = await transactionRes.json();

  if (transaction.status !== "SUCCESS") {
    throw new Error("Shippo label creation failed");
  }

  return {
    trackingNumber: transaction.tracking_number,
    shippingLabelUrl: transaction.label_url,
  };
};

router.get("/orders", protect, isAdmin, async (req, res) => {
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

router.get("/stats", protect, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find();

    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const paidOrders = orders.filter((order) => order.isPaid || order.status === "paid").length;
    const pendingOrders = orders.filter((order) => order.status === "pending").length;

    res.json({
      totalRevenue,
      totalOrders: orders.length,
      paidOrders,
      pendingOrders,
    });
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

router.get("/analytics", protect, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      totalRevenue,
      totalOrders: orders.length,
    });
  } catch (err) {
    console.error("Admin analytics error:", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

router.put("/orders/:id/status", protect, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

router.put("/orders/:id/shipping", protect, isAdmin, async (req, res) => {
  try {
    const { trackingNumber, shippingLabelUrl } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

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

router.post("/orders/:id/create-label", protect, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const shipment = await createShippoTransaction(order.shippingAddress);

    order.trackingNumber = shipment.trackingNumber;
    order.shippingLabelUrl = shipment.shippingLabelUrl;
    order.status = "shipped";
    await order.save();

    res.json({
      message: "Shipping label created",
      tracking: shipment.trackingNumber,
      label: shipment.shippingLabelUrl,
    });
  } catch (err) {
    console.error("Shippo label error:", err);
    res.status(500).json({ message: "Failed to create shipping label" });
  }
});

router.post("/orders/bulk-labels", protect, isAdmin, async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "orderIds array required" });
    }

    const orders = await Order.find({ _id: { $in: orderIds } });
    const results = [];

    for (const order of orders) {
      try {
        const shipment = await createShippoTransaction(order.shippingAddress);

        order.trackingNumber = shipment.trackingNumber;
        order.shippingLabelUrl = shipment.shippingLabelUrl;
        order.status = "shipped";
        await order.save();

        results.push({
          orderId: order._id,
          tracking: shipment.trackingNumber,
          label: shipment.shippingLabelUrl,
        });
      } catch (err) {
        results.push({
          orderId: order._id,
          error: err.message,
        });
      }
    }

    res.json({
      message: "Bulk label generation complete",
      results,
    });
  } catch (err) {
    console.error("Bulk shipping error:", err);
    res.status(500).json({ message: "Bulk shipping failed" });
  }
});

router.put("/orders/:id/delivered", protect, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = "delivered";
    order.deliveredAt = new Date();
    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Mark delivered error:", err);
    res.status(500).json({ message: "Failed to update delivery status" });
  }
});

router.get("/orders/:id/label", protect, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!order.shippingLabelUrl) {
      return res.status(404).json({ message: "Label not created yet" });
    }

    res.json({
      label: order.shippingLabelUrl,
      tracking: order.trackingNumber,
    });
  } catch (err) {
    console.error("Fetch label error:", err);
    res.status(500).json({ message: "Failed to fetch label" });
  }
});

router.post("/newsletter/send", protect, isAdmin, async (req, res) => {
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
            <p>New research compounds and verified batches are now available.</p>
            <a href="https://novapeptidelabs.org/shop"
            style="background:#0ea5e9;color:white;padding:14px 22px;text-decoration:none;border-radius:6px">
            View Research Catalog
            </a>
          </div>
        `,
      });
    }

    res.json({ message: `Newsletter sent to ${subscribers.length} subscribers` });
  } catch (err) {
    console.error("Newsletter send error:", err);
    res.status(500).json({ message: "Failed to send newsletter" });
  }
});

export default router;
