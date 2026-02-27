import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router()

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin'
    })

    return res.status(201).json({ message: 'User registered successfully' })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Registration failed' })
  }
})

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return res.json({ token })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
})

export default router
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router()

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin'
    })

    res.status(201).json({ message: 'User registered successfully' })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Registration failed' })
  }
})

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
  }
})

export default router
// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin' // temporary admin so you can manage products
    })

    res.status(201).json({ message: 'User registered successfully' })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Registration failed' })
  }
})
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'

const router = express.Router()

// ======================
// REGISTER
// ======================
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'admin'
    })

    res.status(201).json({ message: 'User registered successfully' })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Registration failed' })
  }
})

// ======================
// LOGIN
// ======================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token })

  } catch (error) {
    console.error(error)
    res.status(500).json({ message: 'Server error' })
  }
})

export default router
