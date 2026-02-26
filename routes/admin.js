const express = require("express");
const jwt = require("jsonwebtoken");
const Order = require("../models/Order");

const router = express.Router();

function protect(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

router.get("/orders", protect, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

router.get("/analytics", protect, async (req, res) => {
  const orders = await Order.find();

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

  res.json({
    totalRevenue,
    totalOrders: orders.length,
  });
});

module.exports = router;
