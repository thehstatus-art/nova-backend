import express from "express"
import Cart from "../models/Cart.js"

const router = express.Router()

/* =====================================
   SAVE CART (used for abandoned cart)
===================================== */

router.post("/save-cart", async (req, res) => {
  try {

    const { email, items } = req.body

    if (!email || !items || items.length === 0) {
      return res.status(400).json({
        message: "Email and cart items required"
      })
    }

    const cart = await Cart.create({
      email,
      items
    })

    res.json({
      message: "Cart saved",
      cart
    })

  } catch (error) {

    console.error("Cart save error:", error)

    res.status(500).json({
      message: "Failed to save cart"
    })

  }
})

/* =====================================
   GET CART BY EMAIL
===================================== */

router.get("/:email", async (req, res) => {
  try {

    const cart = await Cart.findOne({
      email: req.params.email,
      recovered: false
    }).sort({ createdAt: -1 })

    res.json(cart)

  } catch (error) {

    res.status(500).json({
      message: "Failed to fetch cart"
    })

  }
})

export default router