import express from 'express'
import fetch from 'node-fetch'
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

const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || 'https://api-m.paypal.com'

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

const formatCurrencyAmount = (value) => Number(value || 0).toFixed(2)

const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('PayPal server credentials are not configured')
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text()
    throw new Error(`PayPal auth failed (${tokenRes.status}): ${errorText}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

const getPayPalOrderDetails = async (paypalOrderId) => {
  const accessToken = await getPayPalAccessToken()
  const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!orderRes.ok) {
    const errorText = await orderRes.text()
    throw new Error(`PayPal order lookup failed (${orderRes.status}): ${errorText}`)
  }

  return orderRes.json()
}

const summarizeCompletedCaptures = (paypalOrder) => {
  const completedCaptures = (paypalOrder.purchase_units || []).flatMap((unit) =>
    (unit.payments?.captures || []).filter((capture) => capture.status === 'COMPLETED')
  )

  const totalCaptured = completedCaptures.reduce(
    (sum, capture) => sum + Number(capture.amount?.value || 0),
    0
  )

  const currency = completedCaptures[0]?.amount?.currency_code

  return {
    completedCaptures,
    totalCaptured,
    currency
  }
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

      if (hasCompleteShippingAddress(order.shippingAddress) && !order.shippingLabelUrl) {
        const shipment = await createShippoLabel(order)
        if (shipment) {
          order.shippingLabelUrl = shipment.labelUrl
          order.trackingNumber = shipment.trackingNumber
          await order.save()
        }
      }

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

    const { items, email, shippingAddress } = req.body

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
      shippingAddress,
      shippingDetails: normalizeShippingDetails(shippingAddress),
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

    const {
      items,
      email,
      paypalOrderId,
      totalAmount,
      shippingAddress,
      shippingCost,
      shippingMethod
    } = req.body
    let computedTotal = 0
    const normalizedShippingCost = Math.max(Number(shippingCost) || 0, 0)

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
      totalAmount: totalAmount || computedTotal + normalizedShippingCost,
      shippingCost: normalizedShippingCost,
      shippingMethod,
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

    const {
      items,
      email,
      paypalOrderId,
      shippingAddress,
      shippingCost,
      shippingMethod
    } = req.body

    if (!paypalOrderId) {
      return res.status(400).json({ message: 'PayPal order ID is required' })
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items provided' })
    }

    const existingOrder = await Order.findOne({ paypalOrderId })

    if (existingOrder) {
      console.warn('PayPal order already recorded:', {
        paypalOrderId,
        orderId: existingOrder._id
      })

      return res.json({
        success: true,
        orderId: existingOrder._id,
        existingOrder: true
      })
    }

    let orderItems = []
    let totalAmount = 0
    const normalizedShippingCost = Math.max(Number(shippingCost) || 0, 0)
    const productsToUpdate = []

    for (const item of items) {

      const product = await Product.findById(item.productId || item.product)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId || item.product}` })
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Not enough stock for ${product.name}` })
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity
      })

      productsToUpdate.push({
        product,
        quantity: item.quantity
      })

      totalAmount += product.price * item.quantity

    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: 'No valid items provided' })
    }

    const expectedTotal = totalAmount + normalizedShippingCost
    const paypalOrder = await getPayPalOrderDetails(paypalOrderId)
    const { completedCaptures, totalCaptured, currency } = summarizeCompletedCaptures(paypalOrder)

    if (paypalOrder.status !== 'COMPLETED' || completedCaptures.length === 0) {
      return res.status(400).json({
        message: 'PayPal payment has not been fully captured'
      })
    }

    if (currency && currency !== 'USD') {
      return res.status(400).json({
        message: `Unexpected PayPal currency: ${currency}`
      })
    }

    if (formatCurrencyAmount(totalCaptured) !== formatCurrencyAmount(expectedTotal)) {
      console.error('PayPal amount mismatch:', {
        paypalOrderId,
        expectedTotal: formatCurrencyAmount(expectedTotal),
        capturedTotal: formatCurrencyAmount(totalCaptured)
      })

      return res.status(400).json({
        message: 'PayPal payment amount did not match the order total'
      })
    }

    const paypalEmail =
      paypalOrder.payer?.email_address ||
      paypalOrder.payment_source?.paypal?.email_address ||
      email ||
      ''

    const order = await Order.create({
      items: orderItems,
      totalAmount: expectedTotal,
      shippingCost: normalizedShippingCost,
      shippingMethod,
      paypalOrderId,
      email: paypalEmail,
      customerEmail: paypalEmail,
      shippingAddress,
      shippingDetails: normalizeShippingDetails(shippingAddress),
      isPaid: true,
      paidAt: new Date(),
      status: 'paid'
    })

    console.log('PayPal order saved to MongoDB:', {
      orderId: order._id,
      paypalOrderId,
      itemCount: order.items.length,
      totalAmount: order.totalAmount
    })

    for (const entry of productsToUpdate) {
      entry.product.stock -= entry.quantity
      if (entry.product.stock < 0) entry.product.stock = 0
      await entry.product.save()
    }

    if (hasCompleteShippingAddress(shippingAddress)) {
      try {
        const shipment = await createShippoLabel(order)
        if (shipment) {
          order.shippingLabelUrl = shipment.labelUrl
          order.trackingNumber = shipment.trackingNumber
          await order.save()
        } else {
          console.warn('Shippo label was not created for PayPal order:', {
            orderId: order._id,
            paypalOrderId
          })
        }
      } catch (shippoErr) {
        console.error('Shippo follow-up failed for PayPal order:', {
          orderId: order._id,
          paypalOrderId,
          error: shippoErr.message
        })
      }
    } else {
      console.warn('PayPal order missing complete shipping address for Shippo:', {
        orderId: order._id,
        paypalOrderId
      })
    }

    if (paypalEmail) {
      try {
        await sendOrderConfirmationEmail(order, paypalEmail)
      } catch (mailErr) {
        console.error('PayPal confirmation email failed:', {
          orderId: order._id,
          paypalOrderId,
          error: mailErr.message
        })
      }
    }

    try {
      await sendAdminOrderNotification(order)
    } catch (adminMailErr) {
      console.error('PayPal admin notification failed:', {
        orderId: order._id,
        paypalOrderId,
        error: adminMailErr.message
      })
    }

    emitPurchaseEvent(req, order)

    res.json({ success: true, orderId: order._id })

  } catch (err) {
    console.error('PayPal order error:', {
      paypalOrderId: req.body?.paypalOrderId,
      message: err.message
    })
    res.status(500).json({ message: 'PayPal order failed', error: err.message })
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
