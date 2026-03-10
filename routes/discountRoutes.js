import express from "express";
import Discount from "../models/Discount.js";

const router = express.Router();

router.post("/apply", async (req, res) => {

  const { code } = req.body;

  const discount = await Discount.findOne({
    code: code.toUpperCase(),
    active: true
  });

  if (!discount)
    return res.status(404).json({ message: "Invalid code" });

  if (discount.expiresAt && discount.expiresAt < new Date())
    return res.status(400).json({ message: "Code expired" });

  res.json({
    percent: discount.percent
  });

});

export default router;