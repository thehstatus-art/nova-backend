import mongoose from "mongoose"

/* ======================
   BATCH SCHEMA
====================== */

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

    // which batch is currently sold
    active: {
      type: Boolean,
      default: true
    },
    // inventory for this specific batch
    stock: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { _id: true }
)

/* ======================
   REVIEW SCHEMA
====================== */

const reviewSchema = new mongoose.Schema(
  {
    name: String,
    rating: Number,
    comment: String
  },
  { timestamps: true }
)

/* ======================
   PRODUCT SCHEMA
====================== */

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

    description: String,

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

    image: {
      type: String,
      required: true,
      trim: true
    },

    /* ======================
       SCIENTIFIC DATA
    ====================== */

    molecularWeight: String,

    formula: String,

    sequence: String,

    storage: String,

    purity: String,

    /* ======================
       DOCUMENTATION
    ====================== */

    sdsUrl: String,

    researchDocUrl: String,

    /* ======================
       BUSINESS DATA
    ====================== */

    cost: {
      type: Number,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    },

    featured: {
      type: Boolean,
      default: false
    },

    /* ======================
       BATCH DATA
    ====================== */

    batches: [batchSchema],

    /* ======================
       REVIEWS
    ====================== */

    reviews: [reviewSchema]
  },
  { timestamps: true }
)


/* ======================
   AUTO SYNC TOTAL STOCK
====================== */

productSchema.pre("save", function () {

  if (this.batches && this.batches.length > 0) {

    const total = this.batches.reduce((sum, batch) => {
      return sum + (batch.stock || 0)
    }, 0)

    this.stock = total
  }
})
export default mongoose.model("Product", productSchema)
