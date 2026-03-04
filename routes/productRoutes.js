import express from 'express'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'
import slugify from 'slugify'
import multer from 'multer'
import fs from 'fs'

const router = express.Router()

/* ==============================
   MULTER CONFIG
============================== */

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ storage })

/* ==============================
   CREATE PRODUCT (Admin Only)
============================== */

router.post('/', protect, isAdmin, async (req, res) => {
  try {
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: "Product name is required" })
    }

    const slug = slugify(name, { lower: true, strict: true })

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

/* ==============================
   ADD NEW BATCH
============================== */

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

    product.batches.forEach(b => b.active = false)
    product.batches.push(newBatch)

    await product.save()

    res.status(201).json(product)

  } catch (error) {
    console.error("BATCH ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   UPDATE PRODUCT
============================== */

router.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    Object.assign(product, req.body)
    await product.save()

    res.json(product)

  } catch (error) {
    console.error("UPDATE ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   TOGGLE PRODUCT VISIBILITY
============================== */

router.put('/admin/toggle/:id', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    product.isActive = !product.isActive
    await product.save()

    res.json({
      message: 'Visibility updated',
      isActive: product.isActive
    })

  } catch (error) {
    console.error("TOGGLE ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   UPDATE STOCK
============================== */

router.put('/admin/stock/:id', protect, isAdmin, async (req, res) => {
  try {
    const { stock } = req.body

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    product.stock = stock
    await product.save()

    res.json({ message: 'Stock updated', stock: product.stock })

  } catch (error) {
    console.error("STOCK ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   MARK SOLD OUT
============================== */

router.put('/admin/soldout/:id', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    product.stock = 0
    await product.save()

    res.json({ message: 'Marked as sold out' })

  } catch (error) {
    console.error("SOLD OUT ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   QUICK RESTOCK
============================== */

router.put('/admin/restock/:id', protect, isAdmin, async (req, res) => {
  try {
    const { amount } = req.body

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    product.stock += amount
    await product.save()

    res.json({ message: 'Restocked', stock: product.stock })

  } catch (error) {
    console.error("RESTOCK ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   DELETE PRODUCT
============================== */

router.delete('/admin/:id', protect, isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    await product.deleteOne()

    res.json({ message: 'Product deleted successfully' })

  } catch (error) {
    console.error("DELETE ERROR:", error)
    res.status(500).json({ error: error.message })
  }
})

/* ==============================
   UPLOAD IMAGE
============================== */

router.post('/:id/upload-image', protect, isAdmin, upload.single('image'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (product.image) {
      const oldPath = `.${product.image}`
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    product.image = `/uploads/${req.file.filename}`
    await product.save()

    res.json(product)

  } catch (error) {
    console.error("IMAGE ERROR:", error)
    res.status(500).json({ message: 'Image upload failed' })
  }
})

/* ==============================
   GET ALL PRODUCTS
============================== */

router.get('/', async (req, res) => {
  const products = await Product.find({})
  res.json(products)
})

/* ==============================
   GET SINGLE PRODUCT
============================== */

router.get('/:slug', async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug })

  if (!product) {
    return res.status(404).json({ message: 'Product not found' })
  }

  res.json(product)
})

export default router