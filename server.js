import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import batchRoutes from './routes/batchRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'
import webhookRoutes from './routes/webhookRoutes.js'

import { protect, isAdmin } from './middleware/auth.js'
import Order from './models/Order.js'
import Product from './models/Product.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* ======================
   STRIPE WEBHOOK (MUST BE FIRST)
====================== */

app.use('/api/webhook', webhookRoutes)

/* ======================
   Middleware
====================== */

// JSON must come AFTER webhook
app.use(express.json())

app.use(helmet())

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}))

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ======================
   Rate Limiting
====================== */

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

app.use(globalLimiter)

const batchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20
})

app.use('/api/batch', batchLimiter)

/* ======================
   Database
====================== */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('Mongo connection error:', err))

/* ======================
   Core Routes
====================== */

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/batch', batchRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)

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