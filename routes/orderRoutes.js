import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'

const router = express.Router()

/* =========================================
   🔐 STRIPE INITIALIZATION
========================================= */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY missing")
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim())

/* =========================================
   CHECKOUT ROUTE (PUBLIC)
========================================= */

router.post('/checkout', async (req, res) => {
  try {
    const { items } = req.body || {}

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' })
    }

    let stripeLineItems = []
    let orderItems = []
    let totalAmount = 0

    for (const item of items) {
      const product = await Product.findById(item.productId)

      if (!product) {
        return res.status(404).json({ message: 'Product not found' })
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}`
        })
      }

      const unitAmount = Math.round(product.price * 100)
      totalAmount += product.price * item.quantity

      stripeLineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: unitAmount
        },
        quantity: item.quantity
      })

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      })
    }

    // 🔥 Create Stripe Session WITH metadata
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url:
        'https://novapeptidelabs.com/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://novapeptidelabs.com/cancel',
      metadata: {
        internal_reference: Date.now().toString()
      }
    })

    // Save order BEFORE payment
    await Order.create({
      items: orderItems,
      totalAmount,
      stripeSessionId: session.id,
      isPaid: false,
      status: 'pending'
    })

    return res.json({ url: session.url })

  } catch (error) {
    console.error('🔥 Checkout error:', error)
    return res.status(500).json({ message: 'Checkout failed' })
  }
})

/* =========================================
   GET ORDER BY STRIPE SESSION (NEW)
   Used by Success Page
========================================= */

router.get('/by-session/:sessionId', async (req, res) => {
  try {
    const order = await Order.findOne({
      stripeSessionId: req.params.sessionId
    })

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    return res.json(order)

  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch order' })
  }
})

/* =========================================
   REFUND ROUTE (ADMIN ONLY)
========================================= */

router.post('/refund/:id', protect, isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    if (!order.isPaid) {
      return res.status(400).json({ message: 'Order not paid' })
    }

    const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: stripeLineItems,
  mode: "payment",
  success_url:
    "https://novapeptidelabs.com/success?session_id={CHECKOUT_SESSION_ID}",
  cancel_url: "https://novapeptidelabs.com/cancel",

  customer_email: undefined, // Stripe auto collects

  shipping_address_collection: {
    allowed_countries: ["US"]
  }
})

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id

    await stripe.refunds.create({
      payment_intent: paymentIntentId
    })

    for (const item of order.items) {
      const product = await Product.findById(item.product)
      if (!product) continue
      product.stock += item.quantity
      await product.save()
    }

    order.status = 'refunded'
    await order.save()

    return res.json({ message: 'Refund successful' })

  } catch (err) {
    console.error('🔥 Refund error:', err.message)
    return res.status(500).json({
      message: 'Refund failed',
      error: err.message
    })
  }
})

export default router