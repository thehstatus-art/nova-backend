import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { sendOrderConfirmation } from '../utils/sendEmail.js'

const router = express.Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover'
})

router.post('/', async (req, res) => {

  const sig = req.headers['stripe-signature']

  if (!sig) {
    return res.status(400).send('Missing Stripe signature')
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Webhook secret not configured')
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // MUST be raw buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('🔥 Stripe signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // 🔒 Only handle checkout completion
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true })
  }

  try {
    const session = event.data.object

    const order = await Order.findOne({
      stripeSessionId: session.id
    })

    if (!order) {
      console.warn('⚠️ Order not found for session:', session.id)
      return res.status(200).json({ received: true })
    }

    if (order.isPaid) {
      console.log('⚠️ Order already processed:', order._id)
      return res.status(200).json({ received: true })
    }

    // ✅ Mark paid
    order.isPaid = true
    order.status = 'paid'
    order.paidAt = new Date()
    await order.save()

    // 🔥 Decrease inventory safely
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
        console.log('📧 Email sent to:', user.email)
      } catch (err) {
        console.error('❌ Email failed:', err.message)
      }
    }

    console.log('✅ Order marked paid + inventory updated:', order._id)

    return res.status(200).json({ received: true })

  } catch (err) {
    console.error('🔥 Webhook processing error:', err.message)
    return res.status(500).send('Internal webhook error')
  }
})

export default router