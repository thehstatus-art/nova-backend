import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'

const router = express.Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']

  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.log('Webhook signature verification failed.', err.message)
    return res.sendStatus(400)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    const order = await Order.findOne({ stripeSessionId: session.id })

    if (order && !order.isPaid) {
      order.isPaid = true
      order.paidAt = new Date()
      await order.save()

      // Deduct stock now
      for (const item of order.items) {
        const product = await Product.findById(item.product)
        product.stock -= item.quantity
        await product.save()
      }
    }
  }

  res.json({ received: true })
})

export default router