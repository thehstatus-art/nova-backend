import express from "express";
import Subscriber from "../models/Subscriber.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = express.Router();

router.post("/broadcast", async (req, res) => {

  const subscribers = await Subscriber.find();

  for (const sub of subscribers) {

    await sendEmail({
      to: sub.email,
      subject: "Nova Research Network Update",
      html: `
      <div style="font-family:Arial;padding:30px">

        <img src="https://novapeptidelabs.org/logo.png" width="180"/>

        <h2>Nova Peptide Labs Research Network</h2>

        <p>
        New research compounds are now available.
        Our latest laboratory batches have been verified.
        </p>

        <a href="https://novapeptidelabs.org/shop"
        style="background:#0ea5e9;color:white;padding:14px 22px;text-decoration:none;border-radius:6px">
        View Research Catalog
        </a>

      </div>
      `
    });

  }

  res.json({ success: true });

});

export default router;