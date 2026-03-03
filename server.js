import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import Stripe from 'stripe'

import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import batchRoutes from './routes/batchRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'

import { protect, isAdmin } from './middleware/auth.js'
import Order from './models/Order.js'
import Product from './models/Product.js'
import User from './models/User.js'
import { sendOrderConfirmation } from './utils/sendEmail.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* ======================
   DATABASE CONNECTION
====================== */

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('Mongo connection error:', err)
    process.exit(1)
  })

/* ======================
   🚨 STRIPE WEBHOOK
   MUST BE BEFORE express.json()
====================== */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY missing')
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.error('❌ STRIPE_WEBHOOK_SECRET missing')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    const sig = req.headers['stripe-signature']
    if (!sig) {
      return res.status(400).send('Missing Stripe signature')
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      console.error('🔥 Stripe signature error:', err.message)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type !== 'checkout.session.completed') {
      return res.status(200).json({ received: true })
    }

    try {
      const session = event.data.object

      const order = await Order.findOne({
        stripeSessionId: session.id
      })

      if (!order) {
        console.warn('⚠️ Order not found:', session.id)
        return res.status(200).json({ received: true })
      }

      if (order.isPaid) {
        console.log('⚠️ Order already processed:', order._id)
        return res.status(200).json({ received: true })
      }

      // ✅ Mark as paid
      order.isPaid = true
      order.status = 'paid'
      order.paidAt = new Date()
      await order.save()

      // 🔥 Reduce inventory safely
      for (const item of order.items) {
        const product = await Product.findById(item.product)
        if (!product) continue
        if (product.stock < item.quantity) continue

        product.stock -= item.quantity
        await product.save()
      }

      // 📧 Send confirmation email
      const user = await User.findById(order.user)

      if (user?.email) {
        try {
          await sendOrderConfirmation(order, user.email)
          console.log('📧 Confirmation email sent to:', user.email)
        } catch (err) {
          console.error('❌ Email sending failed:', err.message)
        }
      }

      console.log('✅ Order processed:', order._id)

      return res.status(200).json({ received: true })

    } catch (err) {
      console.error('🔥 Webhook processing error:', err.message)
      return res.status(500).send('Internal webhook error')
    }
  }
)

/* ======================
   BODY PARSER (AFTER WEBHOOK)
====================== */

app.use(express.json())

/* ======================
   SECURITY + CORS
====================== */



app.use(
  cors({
    origin: [
      "https://www.novapeptidelabs.org",
      "https://novapeptidelabs.org",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  })
);

/* ======================
   RATE LIMITING
====================== */

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})

app.use(globalLimiter)

/* ======================
   STATIC FILES
====================== */

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ======================
   ROUTES
====================== */

app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/batch', batchRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/upload', uploadRoutes)

/* ======================
   ADMIN ROUTES
====================== */

app.get('/api/admin/orders', protect, isAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 })
    res.json(orders)
  } catch {
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

app.get('/api/admin/stats', protect, isAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments()
    const paidOrders = await Order.countDocuments({ isPaid: true })
    const pendingOrders = await Order.countDocuments({ isPaid: false })

    const revenueData = await Order.aggregate([
      { $match: { isPaid: true } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
    ])

    const totalRevenue =
      revenueData.length > 0 ? revenueData[0].totalRevenue : 0

    res.json({
      totalRevenue,
      totalOrders,
      paidOrders,
      pendingOrders
    })
  } catch {
    res.status(500).json({ message: 'Failed to load stats' })
  }
})

/* ======================
   HEALTH
====================== */

app.get('/', (req, res) => {
  res.send('Nova Backend is live 🚀')
})

app.get('/api/health', (req, res) => {
  res.json({ message: 'API running' })
})

/* ======================
   START SERVER
====================== */

const PORT = process.env.PORT || 5050

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`)
})