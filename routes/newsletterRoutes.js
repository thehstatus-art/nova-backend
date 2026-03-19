import express from "express";
import Subscriber from "../models/Subscriber.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

// POST /api/newsletter/broadcast
router.post("/broadcast", async (req, res) => {
  try {
    const { subject, html } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ error: "Subject and HTML are required" });
    }

    const subscribers = await Subscriber.find();

    if (!subscribers.length) {
      return res.json({ success: true, count: 0, message: "No subscribers" });
    }

    // Send emails sequentially (safe for small lists)
    for (const sub of subscribers) {
      if (!sub.email) continue;

      await sendEmail({
        to: sub.email,
        subject,
        html
      });
    }

    res.json({ success: true, count: subscribers.length });
  } catch (error) {
    console.error("Newsletter error:", error);
    res.status(500).json({ error: "Failed to send newsletter" });
  }
});

export default router;