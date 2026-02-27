import authRoutes from './routes/authRoutes.js';
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import mongoose from 'mongoose'
import batchRoutes from './routes/batchRoutes.js'

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('Mongo connection error:', err))
import { protect, isAdmin } from './middleware/auth.js'
import Order from './models/Order.js'
import Product from './models/Product.js'

dotenv.config()

const app = express()

/* ======================
   Middleware
====================== */

app.use(express.json())
app.use(helmet())

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

app.use(globalLimiter)

// Batch Route Rate Limiter
const batchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
})

app.use('/api/batch', batchLimiter)

/* ======================
   Core Routes
====================== */

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/batch', batchRoutes)
app.use('/api/auth', authRoutes);

/* ======================
   Admin Routes
====================== */

// Get All Orders
app.get('/api/admin/orders', protect, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.json(orders)
  } catch {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

// Admin Create Product
app.post('/api/admin/products', protect, isAdmin, async (req, res) => {
  try {
    let body = { ...req.body }

    if (!body.batchNumber) {
      const BRAND = 'NP'
      const PRODUCTCODE = (body.slug || body.name || 'PROD')
        .substring(0, 3)
        .toUpperCase()

      const now = new Date()
      const YEAR = String(now.getFullYear()).slice(-2)
      const MONTH = (now.getMonth() + 1).toString().padStart(2, '0')
      const LETTER = String.fromCharCode(65 + Math.floor(Math.random() * 26))

      body.batchNumber = `${BRAND}-${PRODUCTCODE}-${YEAR}${MONTH}-${LETTER}`
    }

    const product = await Product.create(body)
    res.json(product)

  } catch {
    res.status(500).json({ error: 'Failed to create product' })
  }
})

// Admin Delete Product
app.delete('/api/admin/products/:id', protect, isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: 'Deleted' })
  } catch {
    res.status(500).json({ error: 'Delete failed' })
  }
})

/* ======================
   Health Routes
====================== */

app.get('/', (req, res) => {
  res.send('Nova Backend is live 🚀')
})

app.get('/api/health', (req, res) => {
  res.json({ message: 'API running' })
})

/* ======================
   Start Server
====================== */

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`)
})