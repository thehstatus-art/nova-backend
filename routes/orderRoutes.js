import express from 'express'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

router.post('/', protect, async (req, res) => {
  try {
    const { items, shippingAddress } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No order items' })
    }

    let totalAmount = 0

    const orderItems = []

    for (const item of items) {
      const product = await Product.findById(item.productId)

      if (!product) {
        return res.status(404).json({ message: 'Product not found' })
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: 'Insufficient stock' })
      }

      // Reduce stock
      product.stock -= item.quantity
      await product.save()

      totalAmount += product.price * item.quantity

      orderItems.push({
        product: product._id,
        name: product.name,
        batchNumber: product.batchNumber,
        quantity: item.quantity,
        price: product.price
      })
    }

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      totalAmount
    })

    res.status(201).json(order)

  } catch (error) {
    res.status(500).json({ message: 'Server Error' })
  }
})

export default router
