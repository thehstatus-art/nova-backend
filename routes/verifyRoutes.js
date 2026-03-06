import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

/* ================= VERIFY BATCH ================= */

router.get("/:batchNumber", async (req, res) => {

  try {

    const { batchNumber } = req.params;

    const product = await Product.findOne({
      "batches.batchNumber": batchNumber
    });

    if (!product)
      return res.status(404).json({ message: "Batch not found" });

    const batch = product.batches.find(
      b => b.batchNumber === batchNumber
    );

    res.json({
      product: product.name,
      purity: batch.purity,
      manufacturedDate: batch.manufacturedDate,
      coaUrl: batch.coaUrl,
      verified: true
    });

  } catch (err) {

    console.error("Batch verify error:", err);

    res.status(500).json({
      message: "Verification failed"
    });

  }

});

export default router;