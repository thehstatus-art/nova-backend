import mongoose from "mongoose";

const restockAlertSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  productName: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

export default mongoose.model("RestockAlert", restockAlertSchema);