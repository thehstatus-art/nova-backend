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
      required: false
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: false
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

    email: String,

    customerEmail: String,

    paypalOrderId: String,

    shippingDetails: {
      name: String,
      address: String,
      city: String,
      state: String,
      postalCode: String,
      country: String
    },

    shippingAddress: {
      name: String,
      street: String,
      city: String,
      state: String,
      zip: String,
      country: {
        type: String,
        default: "US"
      }
    },

    items: {
      type: [orderItemSchema],
      required: true
    },

    totalAmount: {
      type: Number,
      required: false
    },

    shippingCost: {
      type: Number,
      default: 0
    },

    shippingMethod: String,

    stripeSessionId: String,

    isPaid: {
      type: Boolean,
      default: false
    },

    paidAt: Date,

    trackingNumber: String,

    shippingLabelUrl: String,

    deliveredAt: Date,

    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "refunded"
      ],
      default: "pending"
    }
  },
  { timestamps: true }
)

/// 🔥 AUTO GENERATE ORDER NUMBER
orderSchema.pre("save", function () {
  if (!this.orderNumber) {
    const random = Math.floor(100000 + Math.random() * 900000)
    this.orderNumber = `NOVA-${random}`
  }
})
export default mongoose.model("Order", orderSchema)
