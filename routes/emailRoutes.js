import express from "express";
import Subscriber from "../models/Subscriber.js";

const router = express.Router();

/* ================= EMAIL SUBSCRIBE ================= */

router.post("/subscribe", async (req, res) => {

  try {

    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email required" });

    const exists = await Subscriber.findOne({ email });

    if (exists)
      return res.json({ message: "Already subscribed" });

    const subscriber = await Subscriber.create({ email });

    return res.json({
      success: true,
      subscriber
    });

  } catch (err) {

    console.error("Email subscribe error:", err);

    res.status(500).json({
      message: "Subscription failed"
    });

  }

});

export default router;