import express from 'express'
import multer from 'multer'
import path from 'path'
import { protect, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// Storage config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/')
  },
  filename(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

const upload = multer({ storage })

// POST /api/upload
router.post('/', protect, isAdmin, upload.single('image'), (req, res) => {
  res.json({
    imageUrl: `/uploads/${req.file.filename}`
  })
})

export default router