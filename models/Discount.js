import mongoose from "mongoose";

const discountSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    uppercase: true
  },
  percent: Number,
  active: {
    type: Boolean,
    default: true
  },
  expiresAt: Date
});

export default mongoose.model("Discount", discountSchema);