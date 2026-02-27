import express from 'express'
import Product from '../models/Product.js'

const router = express.Router()

// Verify batch by batch number
router.get('/:batchNumber', async (req, res) => {
  try {
    const { batchNumber } = req.params

    const product = await Product.findOne({
      'batches.batchNumber': batchNumber
    })

    if (!product) {
      return res.status(404).json({ message: 'Batch not found' })
    }

    const batch = product.batches.find(
      b => b.batchNumber === batchNumber
    )

    return res.json({
      product: product.name,
      batchNumber: batch.batchNumber,
      purity: batch.purity,
      manufacturedDate: batch.manufacturedDate,
      coaUrl: batch.coaUrl,
      active: batch.active
    })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
})

export default router
