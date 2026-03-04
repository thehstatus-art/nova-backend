import express from "express"
import multer from "multer"
import { v2 as cloudinary } from "cloudinary"
import { CloudinaryStorage } from "multer-storage-cloudinary"

const router = express.Router()

/* =========================
   CLOUDINARY CONFIG
========================= */

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error("❌ Cloudinary environment variables missing")
  process.exit(1)
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
  api_key: process.env.CLOUDINARY_API_KEY.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET.trim()
})

/* =========================
   MULTER STORAGE (CLOUDINARY)
========================= */

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "nova-products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, crop: "limit" }]
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
})

/* =========================
   UPLOAD ROUTE
========================= */

router.post("/", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" })
    }

    res.json({
      imageUrl: req.file.path // full Cloudinary URL
    })
  } catch (err) {
    console.error("🔥 Upload error:", err.message)
    res.status(500).json({ message: "Image upload failed" })
  }
})

export default router