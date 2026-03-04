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
import shippo from 'shippo'

import authRoutes from './routes/authRoutes.js'
import productRoutes from './routes/productRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import batchRoutes from './routes/batchRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'

import { protect, isAdmin } from './middleware/auth.js'
import Order from './models/Order.js'
import Product from './models/Product.js'
import {
  sendOrderConfirmation,
  sendAdminSaleAlert,
  
  sendTrackingEmail
} from './utils/sendEmail.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.set('trust proxy', 1)

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('Mongo connection error:', err)
    process.exit(1)
  })

/* ================= STRIPE ================= */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY missing")
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim())



/* ================= SHIPPO ================= */

const shippoClient = process.env.SHIPPO_API_KEY
  ? shippo(process.env.SHIPPO_API_KEY)
  : null

/* ================= SHIPPING FUNCTION ================= */

async function generateShippingLabel(order) {

  if (!shippoClient || !order?.shippingDetails || order.shippingLabelUrl)
    return

  try {
    const shipment = await shippoClient.shipments.create({
      address_from: {
        name: "Nova Peptide Labs",
        street1: "6801 14th ave apt 1",
        city: "Brooklyn",
        state: "NY",
        zip: "11219",
        country: "US"
      },
      address_to: {
        name: order.shippingDetails.name,
        street1: order.shippingDetails.address,
        city: order.shippingDetails.city,
        state: order.shippingDetails.state,
        zip: order.shippingDetails.postalCode,
        country: order.shippingDetails.country
      },
      parcels: [{
        length: "6",
        width: "4",
        height: "2",
        distance_unit: "in",
        weight: "0.5",
        mass_unit: "lb"
      }]
    })

    const rate = shipment.rates?.find(r => r.provider === "USPS")
    if (!rate) return

    const transaction = await shippoClient.transactions.create({
      rate: rate.object_id,
      label_file_type: "PDF"
    })

    if (transaction.status !== "SUCCESS") return

    order.shippingLabelUrl = transaction.label_url
    order.trackingNumber = transaction.tracking_number
    order.status = "shipped"

    await order.save()

    if (order.customerEmail)
      await sendTrackingEmail(order)

    console.log("✅ Shipping label generated:", order._id)

  } catch (err) {
    console.error("Shippo error:", err.message)
  }
}

/* ================= LIVE USPS RATES ================= */

app.post('/api/shipping/rates', async (req, res) => {
  try {

    if (!shippoClient)
      return res.status(400).json({ message: "Shipping not active" })

    const { address } = req.body

    const shipment = await shippoClient.shipments.create({
      address_from: {
        name: "Nova Peptide Labs",
        street1: "YOUR BUSINESS ADDRESS",
        city: "Hoboken",
        state: "NJ",
        zip: "07030",
        country: "US"
      },
      address_to: {
        name: address.name,
        street1: address.line1,
        city: address.city,
        state: address.state,
        zip: address.postalCode,
        country: address.country
      },
      parcels: [{
        length: "6",
        width: "4",
        height: "2",
        distance_unit: "in",
        weight: "0.5",
        mass_unit: "lb"
      }]
    })

    const rates = shipment.rates
      .filter(r => r.provider === "USPS")
      .map(r => ({
        service: r.servicelevel.name,
        price: r.amount,
        rateId: r.object_id
      }))

    res.json(rates)

  } catch (err) {
    console.error("Shipping rate error:", err.message)
    res.status(500).json({ message: "Failed to fetch shipping rates" })
  }
})

/* ================= STRIPE WEBHOOK ================= */

app.post('/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {

    const sig = req.headers['stripe-signature']
    if (!sig) return res.status(400).send('Missing Stripe signature')

    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    if (event.type !== 'checkout.session.completed')
      return res.status(200).json({ received: true })

    try {
      const session = event.data.object
      const order = await Order.findOne({ stripeSessionId: session.id })

      if (!order || order.isPaid)
        return res.status(200).json({ received: true })

      order.isPaid = true
      order.status = "paid"
      order.paidAt = new Date()
      order.customerEmail = session.customer_details?.email || ""

      if (session.shipping_details) {
        order.shippingDetails = {
          name: session.shipping_details.name,
          address: session.shipping_details.address.line1,
          city: session.shipping_details.address.city,
          state: session.shipping_details.address.state,
          postalCode: session.shipping_details.address.postal_code,
          country: session.shipping_details.address.country
        }
      }

      await order.save()

      if (order.customerEmail)
        await sendOrderConfirmation(order, order.customerEmail)

      await sendAdminSaleAlert(order)

      // Reduce stock
      for (const item of order.items) {
        const product = await Product.findById(item.product)
        if (!product) continue

        product.stock -= item.quantity
        await product.save()
      }

      // Generate shipping label
      await generateShippingLabel(order)

      return res.status(200).json({ received: true })

    } catch (err) {
      console.error("Webhook error:", err)
      return res.status(500).send('Webhook error')
    }
  }
)

/* ================= BULK LABELS ================= */

app.post('/api/admin/bulk-labels', protect, isAdmin, async (req, res) => {

  const { orderIds } = req.body

  const orders = await Order.find({
    _id: { $in: orderIds },
    isPaid: true,
    shippingLabelUrl: { $exists: false }
  })

  for (const order of orders)
    await generateShippingLabel(order)

  res.json({ message: "Bulk labels processed" })
})

/* ================= SHIPPING DASHBOARD ================= */

app.get('/api/admin/shipping', protect, isAdmin, async (req, res) => {

  const orders = await Order.find({ isPaid: true })
    .sort({ createdAt: -1 })

  res.json(orders.map(order => ({
    id: order._id,
    email: order.customerEmail,
    status: order.status,
    tracking: order.trackingNumber,
    label: order.shippingLabelUrl
  })))
})

/* ================= MIDDLEWARE ================= */

app.use(express.json())
app.use(helmet())
app.use(cors({ origin: true, credentials: true }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ================= START ================= */

const PORT = process.env.PORT || 5050
app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`)
})