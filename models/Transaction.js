// models/Transaction.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  payee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  isSettled: { type: Boolean, default: false },
  type: { type: String, enum: ["expense", "payment", "settlement"] }, // settle = manual payment
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: "Expense" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Transaction", transactionSchema);
