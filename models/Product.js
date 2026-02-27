import mongoose from 'mongoose'

const batchSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true },
  purity: { type: String },
  manufacturedDate: { type: Date },
  coaUrl: { type: String },
  active: { type: Boolean, default: true }
})

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    description: String,
    price: { type: Number, required: true },
    stock: { type: Number, default: 0 },
    category: String,
    image: String,
    molecularWeight: String,
    formula: String,
    storage: String,
    batches: [batchSchema]
  },
  { timestamps: true }
)

export default mongoose.model('Product', productSchema)