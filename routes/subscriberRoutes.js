import express from "express";
import Subscriber from "../models/Subscriber.js";

const router = express.Router();

router.post("/subscribe", async (req, res) => {

  try {

    const { email } = req.body;

    const exists = await Subscriber.findOne({ email });

    if (exists) {
      return res.json({ message: "Already subscribed" });
    }

    await Subscriber.create({ email });

    res.json({ success: true });

  } catch (err) {

    console.error("Subscribe error:", err);
    res.status(500).json({ message: "Subscription failed" });

  }

});

export default router;