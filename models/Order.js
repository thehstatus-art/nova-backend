import mongoose from "mongoose"

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    }
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    // 🧾 Professional Order Number
    orderNumber: {
      type: String,
      unique: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    customerEmail: String,

    shippingDetails: {
      name: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },

    items: {
      type: [orderItemSchema],
      required: true
    },

    totalAmount: {
      type: Number,
      required: true
    },

    stripeSessionId: String,

    isPaid: {
      type: Boolean,
      default: false
    },

    paidAt: Date,

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
        "refunded"
      ],
      default: "pending"
    }
  },
  { timestamps: true }
)

// 🔥 AUTO GENERATE ORDER NUMBER
orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    const random = Math.floor(100000 + Math.random() * 900000)
    this.orderNumber = `NOVA-${random}`
  }
  next()
})

export default mongoose.model("Order", orderSchema)