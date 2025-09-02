import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const groupSchema = new Schema(
  {
    name: { type: String, required: true },

    members: [
      {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'member'], default: 'member' },
        status: { type: String, enum: ['invited', 'joined'], default: 'invited' } // corrected default
      }
    ],

    expenses: [{ type: Types.ObjectId, ref: 'Expense' }],

    invites: [{ type: String }]  // Array of invited email addresses
  },
  { timestamps: true }
);

const Group = model("Group", groupSchema);
export default Group;
