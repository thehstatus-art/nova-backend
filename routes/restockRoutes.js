import express from "express";
import RestockAlert from "../models/RestockAlert.js";

const router = express.Router();

router.post("/", async (req, res) => {

  try {

    const { email, productId, productName } = req.body;

    const alert = new RestockAlert({
      email,
      productId,
      productName
    });

    await alert.save();

    res.json({ success: true });

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Failed to save restock alert" });

  }

});

export default router;