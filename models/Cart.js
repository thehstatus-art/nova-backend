import mongoose from "mongoose"

const cartSchema = new mongoose.Schema(
{
  email: {
    type: String,
    required: true,
    index: true
  },

  items: [
    {
      productId: String,
      name: String,
      price: Number,
      quantity: Number
    }
  ],

  recovered: {
    type: Boolean,
    default: false
  }

},
{ timestamps: true }
)

export default mongoose.model("Cart", cartSchema)