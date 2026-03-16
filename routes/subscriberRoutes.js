import express from "express";
import Subscriber from "../models/Subscriber.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();

// ADD SUBSCRIBER
router.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const exists = await Subscriber.findOne({ email });

    if (exists) {
      return res.json({ message: "Already subscribed" });
    }

    await Subscriber.create({ email });

    // optional welcome email
    try {
      await sendEmail({
        to: email,
        subject: "Welcome to the Nova Research Network",
        html: `
          <h2>Welcome Researcher</h2>
          <p>You are now part of the Nova Research Network.</p>

          <p>Explore our current laboratory compounds:</p>

          <ul>
            <li>Retatrutide</li>
            <li>Tesamorelin</li>
            <li>GHK-Cu</li>
            <li>KLOW-80</li>
            <li>BPC-157</li>
            <li>DSIP</li>
            <li>5-Amino-1MQ</li>
          </ul>

          <p>
            Visit the research catalog:
            <br/>
            <a href="https://novapeptidelabs.org">NovaPeptideLabs.org</a>
          </p>

          <p>— NovaPeptideLabs</p>
        `
      });
    } catch (emailErr) {
      console.error("Welcome email failed:", emailErr);
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Subscribe error:", err);
    res.status(500).json({ message: "Subscription failed" });
  }
});


// GET SUBSCRIBER COUNT (for live ticker)
router.get("/count", async (req, res) => {
  try {
    const count = await Subscriber.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Failed to get count" });
  }
});


// SEND NEWSLETTER TO ALL SUBSCRIBERS
router.post("/send-newsletter", async (req, res) => {
  try {
    const subscribers = await Subscriber.find();

    for (const sub of subscribers) {
      await sendEmail({
        to: sub.email,
        subject: "NovaPeptideLabs Research Update",
        html: `
          <h2>NovaPeptideLabs Research Update</h2>

          <p>New compounds available in our laboratory inventory.</p>

          <ul>
            <li>Retatrutide</li>
            <li>Tesamorelin</li>
            <li>GHK-Cu</li>
            <li>KLOW-80</li>
            <li>BPC-157</li>
            <li>DSIP</li>
            <li>5-Amino-1MQ</li>
          </ul>

          <p>
            View the full research catalog:
            <br/>
            <a href="https://novapeptidelabs.org">Visit NovaPeptideLabs</a>
          </p>

          <p>Certified research compounds • ≥99% purity</p>

          <p>— NovaPeptideLabs</p>
        `
      });
    }

    res.json({
      success: true,
      sent: subscribers.length
    });

  } catch (err) {
    console.error("Newsletter error:", err);
    res.status(500).json({ message: "Newsletter failed" });
  }
});

export default router;