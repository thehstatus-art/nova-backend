import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    price: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (val) {
          return val.length > 0
        },
        message: 'Order must contain at least one item'
      }
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    stripeSessionId: {
      type: String,
      index: true
    },

    isPaid: {
      type: Boolean,
      default: false
    },

    paidAt: Date,

    status: {
      type: String,
      enum: [
        'pending',
        'paid',
        'shipped',
        'delivered',
        'cancelled',
        'refunded' // ✅ ADDED THIS
      ],
      default: 'pending'
    }
  },
  { timestamps: true }
)

export default mongoose.model('Order', orderSchema)