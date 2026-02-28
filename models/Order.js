import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      quantity: Number,
      price: Number,
      batchNumber: String
    }
  ],
  totalAmount: Number,
  stripeSessionId: String,
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: Date
}, { timestamps: true })

export default mongoose.model('Order', orderSchema)