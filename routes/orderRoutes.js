import express from 'express'
import Stripe from 'stripe'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { protect, isAdmin } from '../middleware/auth.js'

import { sendAbandonedCheckoutEmail, sendOrderConfirmationEmail, sendAdminOrderNotification } from '../utils/sendEmail.js'
import { createShippoLabel } from '../utils/createShippoLabel.js'

// helper to emit real purchase notifications
const emitPurchaseEvent = (req, order) => {
  try {
    const io = req.app.get('io')
    if (!io) return

    const firstItem = order.items?.[0]

    io.emit('purchase', {
      product: firstItem?.name || 'Research Compound',
      location: 'USA',
      time: new Date()
    })

    // send full order to admin dashboard for live updates
    io.emit('new-order', order)

  } catch (err) {
    console.error('Socket emit failed:', err)
  }
}

const router = express.Router()

const normalizeShippingDetails = (shippingAddress = {}) => ({
  name: shippingAddress.name || '',
  address: shippingAddress.street || '',
  city: shippingAddress.city || '',
  state: shippingAddress.state || '',
  postalCode: shippingAddress.zip || '',
  country: shippingAddress.country || 'US'
})

const hasCompleteShippingAddress = (shippingAddress = {}) => {
  return Boolean(
    shippingAddress.name &&
    shippingAddress.street &&
    shippingAddress.city &&
    shippingAddress.state &&
    shippingAddress.zip
  )
}

/* ===============================
   STRIPE INITIALIZATION
================================ */


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

/* ===============================
   STRIPE WEBHOOK (CONFIRM PAYMENT)
================================ */

router.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {

  let event

  try {

    const sig = req.headers['stripe-signature']

    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      endpointSecret
    )

  } catch (err) {

    console.error('Stripe webhook signature failed:', err.message)

    return res.status(400).send(`Webhook Error: ${err.message}`)

  }

  if (event.type === 'checkout.session.completed') {

    const session = event.data.object

    try {

      const order = await Order.findOne({ stripeSessionId: session.id })

      if (!order) {
        console.error('Stripe order not found:', session.id)
        return res.json({ received: true })
      }

      if (order.isPaid) {
        return res.json({ received: true })
      }

      order.isPaid = true
      order.status = 'paid'

      for (const item of order.items) {

        const product = await Product.findById(item.product)

        if (!product) continue

        product.stock -= item.quantity

        if (product.stock < 0) product.stock = 0

        await product.save()

      }

      await order.save()

      try {

        if (order.email) {
          await sendOrderConfirmationEmail(order, order.email)
        }

        await sendAdminOrderNotification(order)

      } catch (mailErr) {

        console.error('Email notification error:', mailErr)

      }

      console.log('Stripe order confirmed:', order._id)

      emitPurchaseEvent(req, order)

    } catch (err) {

      console.error('Stripe webhook processing error:', err)

    }

  }

  res.json({ received: true })

})

/* ===============================
   CREATE STRIPE CHECKOUT
================================ */

router.post('/checkout', async (req, res) => {
  try {

    const { items, email } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' })
    }

    let stripeItems = []
    let orderItems = []
    let computedTotal = 0
    let totalAmount = 0

    for (const item of items) {

      const product = await Product.findById(item.productId)

      if (!product) {
        return res.status(404).json({ message: 'Product not found' })
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` })
      }

      stripeItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100)
        },
        quantity: item.quantity
      })

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      })

      totalAmount += product.price * item.quantity

    }

    const order = await Order.create({
      items: orderItems,
      totalAmount,
      email,
      customerEmail: email,
      isPaid: false,
      status: 'pending'
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeItems,
      mode: 'payment',
      customer_email: email,
      success_url: 'https://novapeptidelabs.org/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://novapeptidelabs.org/cancel',
      metadata: {
        orderId: order._id.toString()
      }
    })

    order.stripeSessionId = session.id
    await order.save()

    setTimeout(() => sendAbandonedCheckoutEmail(email, 1), 1000 * 60 * 30)
    setTimeout(() => sendAbandonedCheckoutEmail(email, 2), 1000 * 60 * 60 * 6)
    setTimeout(() => sendAbandonedCheckoutEmail(email, 3), 1000 * 60 * 60 * 24)

    res.json({ url: session.url })

  } catch (err) {
    console.error('Checkout error:', err)
    res.status(500).json({ message: 'Checkout failed' })
  }
})

// Generic order save (used by frontend checkout)
router.post('/', async (req, res) => {
  try {

    const { items, email, paypalOrderId, totalAmount, shippingAddress } = req.body
    let computedTotal = 0

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' })
    }

    let orderItems = []

    for (const item of items) {

      const product = await Product.findById(item.productId || item.product)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId || item.product}` })
      }

      product.stock -= item.quantity
      if (product.stock < 0) product.stock = 0

      await product.save()

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      })
      computedTotal += product.price * item.quantity
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: 'No valid items provided' })
    }

    const order = await Order.create({
      items: orderItems,
      totalAmount: totalAmount || computedTotal,
      paypalOrderId,
      email,
      customerEmail: email,
      shippingAddress,
      shippingDetails: normalizeShippingDetails(shippingAddress),
      isPaid: true,
      paidAt: new Date(),
      status: 'paid'
    })

    if (hasCompleteShippingAddress(shippingAddress)) {
      const shipment = await createShippoLabel(order)
      if (shipment) {
        order.shippingLabelUrl = shipment.labelUrl
        order.trackingNumber = shipment.trackingNumber
        await order.save()
      }
    }

    if (email) {
      await sendOrderConfirmationEmail(order, email)
    }

    await sendAdminOrderNotification(order)

    emitPurchaseEvent(req, order)

    res.json({ success: true, orderId: order._id })

  } catch (err) {
    console.error('🚨 ORDER SAVE ERROR:', err)

    res.status(500).json({
      message: 'Order save failed',
      error: err.message
    })
  }
})

/* ===============================
   PAYPAL ORDER SAVE
================================ */

router.post('/paypal', async (req, res) => {
  try {

    const { items, email, paypalOrderId, shippingAddress } = req.body

    let orderItems = []
    let totalAmount = 0

    for (const item of items) {

      const product = await Product.findById(item.productId || item.product)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId || item.product}` })
      }

      product.stock -= item.quantity
      if (product.stock < 0) product.stock = 0

      await product.save()

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      })

      totalAmount += product.price * item.quantity

    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: 'No valid items provided' })
    }

    const order = await Order.create({
      items: orderItems,
      totalAmount,
      paypalOrderId,
      email,
      customerEmail: email,
      shippingAddress,
      shippingDetails: normalizeShippingDetails(shippingAddress),
      isPaid: true,
      paidAt: new Date(),
      status: 'paid'
    })

    if (hasCompleteShippingAddress(shippingAddress)) {
      const shipment = await createShippoLabel(order)
      if (shipment) {
        order.shippingLabelUrl = shipment.labelUrl
        order.trackingNumber = shipment.trackingNumber
        await order.save()
      }
    }

    if (email) {
      await sendOrderConfirmationEmail(order, email)
    }

    await sendAdminOrderNotification(order)

    emitPurchaseEvent(req, order)

    res.json({ success: true, orderId: order._id })

  } catch (err) {
    console.error('PayPal order error:', err)
    res.status(500).json({ message: 'PayPal order failed' })
  }
})

/* ===============================
   ADMIN GET ORDERS
================================ */

router.get('/', protect, isAdmin, async (req, res) => {
  try {

    const orders = await Order.find().sort({ createdAt: -1 })

    res.json(orders)

  } catch (err) {
    console.error('Fetch orders error:', err)
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

/* ===============================
   RECENT ORDERS FOR POPUPS
================================ */

router.get('/recent-orders', async (req, res) => {
  try {

    const orders = await Order.find({ isPaid: true })
      .sort({ createdAt: -1 })
      .limit(10)

    const recent = orders.map(order => ({
      product: order.items?.[0]?.name || 'Research Compound',
      location: 'USA',
      time: order.createdAt
    }))

    res.json(recent)

  } catch (err) {
    console.error('Recent orders error:', err)
    res.status(500).json({ message: 'Failed to load recent orders' })
  }
})

export default router
