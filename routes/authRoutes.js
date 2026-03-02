import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router()

console.log("🔥 Auth routes loaded")

/* =========================
   REGISTER
========================= */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await User.create({
      email,
      password: hashedPassword,
      role: 'admin'
    })

    return res.status(201).json({
      message: 'User registered successfully',
      userId: newUser._id
    })

  } catch (error) {
    console.error("❌ REGISTER ERROR:", error)
    return res.status(500).json({ message: 'Registration failed' })
  }
})

/* =========================
   LOGIN
========================= */
router.post('/login', async (req, res) => {
  try {
    console.log("🚨 LOGIN ROUTE HIT")

    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' })
    }

    const user = await User.findOne({ email })

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    if (!process.env.JWT_SECRET) {
      console.error("❌ JWT_SECRET missing")
      return res.status(500).json({ message: 'JWT not configured' })
    }

    console.log("✅ JWT SECRET FOUND:", process.env.JWT_SECRET)

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    })

  } catch (error) {
    console.error("❌ LOGIN ERROR:", error)
    return res.status(500).json({ message: 'Server error' })
  }
})

export default router