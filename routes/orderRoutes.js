import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'

const router = express.Router()

/* =========================================
   🔐 STRIPE INITIALIZATION (FINAL CLEAN VERSION)
========================================= */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY missing")
  process.exit(1)
}

// Trim removes hidden newline/space issues
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: 'https://novapeptidelabs.com/success',
      cancel_url: 'https://novapeptidelabs.com/cancel'
    })

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

    const session = await stripe.checkout.sessions.retrieve(
      order.stripeSessionId,
      { expand: ['payment_intent'] }
    )

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