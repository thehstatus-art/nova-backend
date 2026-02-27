const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  category: String,
  image: String,
  description: String,
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
    unique: true,
    required: true
  },
  testDate: Date,
  coaUrl: String,
  hplcImage: String
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);