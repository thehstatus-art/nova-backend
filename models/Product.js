import mongoose from "mongoose"

const batchSchema = new mongoose.Schema(
  {
    batchNumber: { 
      type: String, 
      required: true,
      trim: true 
    },
    purity: { 
      type: String,
      trim: true 
    },
    manufacturedDate: { 
      type: Date 
    },
    coaUrl: { 
      type: String,
      trim: true 
    },
    active: { 
      type: Boolean, 
      default: true 
    }
  },
  { _id: true }
)

const productSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true 
    },

    slug: { 
      type: String, 
      unique: true, 
      required: true,
      lowercase: true,
      trim: true 
    },

    description: { 
      type: String 
    },

    price: { 
      type: Number, 
      required: true,
      min: 0 
    },

    stock: { 
      type: Number, 
      default: 0,
      min: 0 
    },

    category: { 
      type: String,
      trim: true 
    },

    // 🔥 CLOUDINARY IMAGE URL
    image: { 
      type: String,
      required: true,
      trim: true 
    },

    molecularWeight: { 
      type: String 
    },

    formula: { 
      type: String 
    },

    storage: { 
      type: String 
    },

    batches: [batchSchema]
  },
  { timestamps: true }
)

export default mongoose.model("Product", productSchema)