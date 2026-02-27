import express from 'express'
import Product from '../models/Product.js'

const router = express.Router()

router.get('/:batchNumber', async (req, res) => {
  try {
    const product = await Product.findOne({
      batchNumber: req.params.batchNumber
    })

    if (!product) {
      return res.status(404).json({ message: 'Batch not found' })
    }

    res.json({
      productName: product.name,
      purity: product.specifications.purity,
      testDate: product.testDate,
      coaUrl: product.coaUrl
    })

  } catch (error) {
    res.status(500).json({ message: 'Server Error' })
  }
})

export default router
