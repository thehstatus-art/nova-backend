import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY not set in environment')
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/* =========================
   CREATE STRIPE CHECKOUT
========================= */

router.post('/checkout', protect, async (req, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No order items provided' })
    }

    let lineItems = []
    let totalAmount = 0
    let orderItems = []

    for (const item of items) {
      const product = await Product.findById(item.productId)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` })
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` })
      }

      const unitAmount = Math.round(product.price * 100)

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name
          },
          unit_amount: unitAmount
        },
        quantity: item.quantity
      })

      totalAmount += product.price * item.quantity

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: product.price
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cancel`
    })

    await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      stripeSessionId: session.id,
      isPaid: false
    })

    return res.status(200).json({ url: session.url })

  } catch (error) {
    console.error('STRIPE CHECKOUT ERROR:', error)
    return res.status(500).json({ message: 'Checkout failed', error: error.message })
  }
})

export default router