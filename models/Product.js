import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  specifications: {
    purity: String,
    molecularWeight: String,
    molecularFormula: String,
    casNumber: String,
    form: String,
    storage: String,
    appearance: String
  },
  batchNumber: {
    type: String,
    unique: true
  },
  testDate: Date,
  coaUrl: String
}, { timestamps: true })

export default mongoose.model('Product', productSchema)