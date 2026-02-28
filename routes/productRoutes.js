import express from 'express'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'
import slugify from 'slugify'
const router = express.Router()

// CREATE PRODUCT (Admin Only)
router.post('/', protect, isAdmin, async (req, res) => {
  try {router.post('/', protect, isAdmin, async (req, res) => {
  try {
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: "Product name is required" })
    }

    const slug = slugify(name, {
      lower: true,
      strict: true
    })

    const product = await Product.create({
      ...req.body,
      slug
    })

    res.status(201).json(product)
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})
    const product = await Product.create(req.body)
    res.status(201).json(product)
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

// ADD NEW BATCH TO PRODUCT (Admin Only)
router.post('/:id/batch', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    const newBatch = {
      batchNumber: req.body.batchNumber,
      purity: req.body.purity,
      manufacturedDate: req.body.manufacturedDate,
      coaUrl: req.body.coaUrl,
      active: true
    }

    if (!product.batches) product.batches = []

    product.batches.forEach(b => b.active = false)
    product.batches.push(newBatch)

    await product.save()

    res.status(201).json(product)

  } catch (error) {
    console.error("BATCH ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})
// UPDATE PRODUCT (Admin Only)
router.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    res.json(product)

  } catch (error) {
    console.error("UPDATE ERROR:", error)
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

  res.json(product
nano routes/productRoutes.js

