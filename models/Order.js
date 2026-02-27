import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      name: String,
      batchNumber: String,
      quantity: Number,
      price: Number
    }
  ],

  shippingAddress: {
    fullName: String,
    address: String,
    city: String,
    state: String,
    postalCode: String,
    country: String
  },

  totalAmount: Number,

  status: {
    type: String,
    enum: ['pending', 'paid', 'shipped', 'cancelled'],
    default: 'pending'
  }

}, { timestamps: true })

export default mongoose.model('Order', orderSchema)