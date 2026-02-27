import express from 'express'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// CREATE PRODUCT (Admin Only)
router.post('/', protect, isAdmin, async (req, res) => {
  try {
    console.log("Incoming product:", req.body)

    const product = await Product.create(req.body)

    res.status(201).json(product)
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

// GET ALL PRODUCTS
router.get('/', async (req, res) => {
  const products = await Product.find({})
  res.json(products)
})

// GET SINGLE PRODUCT
router.get('/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })

  if (!product) {
    return res.status(404).json({ message: 'Product not found' })
  }

  res.json(product)
})

export default router
