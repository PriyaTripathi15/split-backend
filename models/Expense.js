import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const expenseSchema = new Schema(
  {
    groupId: {
      type: Types.ObjectId,
      ref: "Group",
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    paidBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    splitType: {
      type: String,
      enum: ["equal", "exact", "percentage"],
      required: true,
    },
    isSettled: {
  type: Boolean,
  default: false,
},
    category: {
      type: String,
      required: true,
      enum: [
        "Food",
        "Travel",
        "Accommodation",
        "Groceries",
        "Utilities",
        "Entertainment",
        "Shopping",
        "Others",
      ],
    },
    splitBetween: [
      {
        userId: {
          type: Types.ObjectId,
          ref: "User",
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],

    // ✅ Add this to support settlement population
    settlements: [
      {
        type: Types.ObjectId,
        ref: "Settlement",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Expense = model("Expense", expenseSchema);
export default Expense;
