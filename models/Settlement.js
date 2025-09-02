import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMode: {
      type: String,
      enum: ["offline", "stripe"],
    },
    paymentId: {
      type: String, // Stripe payment_id
    },
    orderId: {
      type: String, // Razorpay order_id
    },
    signature: {
      type: String, // Razorpay signature
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "success", "failed"],
      default: "pending",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true } // includes createdAt and updatedAt
);

export default mongoose.model("Settlement", settlementSchema);
