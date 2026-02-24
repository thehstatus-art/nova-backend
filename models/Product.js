const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    price: Number,
    category: String,
    purity: String,
    stock: Number,
    image: String,
    specifications: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);