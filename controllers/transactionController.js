import crypto from "crypto";
import axios from "axios";
import Transaction from "../models/Transaction.js";
import Settlement from "../models/Settlement.js";
import { notifySettlement } from "../utils/notifications.js"; // 🔔 import your notification helper
import User from "../models/User.js";
import Group from "../models/Group.js";
import Expense from "../models/Expense.js";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
 




export const settleUp = async (req, res) => {
  const {
    groupId,
    payer,
    payee,
    amount,
    type,
    paymentMode = "offline",
    paymentId,
    orderId,
    signature,
  } = req.body;

  if (!groupId || !payer || !payee || !amount || !type) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const [payerUser, payeeUser, group] = await Promise.all([
      User.findById(payer),
      User.findById(payee),
      Group.findById(groupId),
    ]);

    if (!payerUser || !payeeUser || !group) {
      return res.status(404).json({ message: "User or Group not found" });
    }

    const groupName = group.name;
    const fromUser = payerUser.fullName;
    const toUser = payeeUser.fullName;

    // ✅ Set status: success for Stripe, approved for offline
    const status = paymentMode === "stripe" ? "success" : "approved";

    // ✅ Create new Settlement
    const settlement = new Settlement({
      groupId,
      payer,
      payee,
      amount,
      type,
      paymentMode,
      paymentId,
      orderId,
      signature,
      status,
      createdBy: req.user._id,
    });
    await settlement.save();

    // ✅ Find all unsettled expenses involving payer & payee
    const relatedExpenses = await Expense.find({
      groupId,
      isSettled: false,
      $or: [
        { paidBy: payer, "splitBetween.userId": payee },
        { paidBy: payee, "splitBetween.userId": payer },
      ],
    });

    for (const exp of relatedExpenses) {
      // Link new settlement
      if (!exp.settlements.includes(settlement._id)) {
        exp.settlements.push(settlement._id);
      }

      // Include all settlements for this expense (status = success or approved)
      const allSettlements = await Settlement.find({
        $or: [
          { payer: exp.paidBy, payee: { $in: exp.splitBetween.map(u => u.userId) } },
          { payer: { $in: exp.splitBetween.map(u => u.userId) }, payee: exp.paidBy },
        ],
        groupId: exp.groupId,
        status: { $in: ["success", "approved"] },
      });

      // Link old settlements if not already linked
      for (const s of allSettlements) {
        if (!exp.settlements.includes(s._id)) {
          exp.settlements.push(s._id);
        }
      }

      // Calculate total settled
      const totalSettled = allSettlements.reduce((sum, s) => sum + s.amount, 0);

      // Mark expense as settled if fully paid
      if (totalSettled >= exp.amount) {
        exp.isSettled = true;
      }

      await exp.save();
    }

    // ✅ Create Transaction record
    const transaction = new Transaction({
      groupId,
      payer,
      payee,
      amount,
      type: "settlement",
    });
    await transaction.save();

    // ✅ Notify users
    await Promise.all([
      notifySettlement(payer, fromUser, toUser, groupName),
      notifySettlement(payee, fromUser, toUser, groupName),
    ]);

    const message =
      paymentMode === "offline"
        ? "Offline settlement request sent. Awaiting approval."
        : "Payment successful & settlement recorded!";

    res.status(201).json({
      message,
      settlement,
      linkedExpenses: relatedExpenses.map((e) => e._id),
    });
  } catch (err) {
    console.error("Error in settlement:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





// ✅ Approve a pending settlement
export const approveSettlement = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const settlement = await Settlement.findById(id);
    if (!settlement) return res.status(404).json({ message: "Settlement not found" });

    // Only payee can approve
    if (settlement.payee.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to approve this settlement" });
    }

    if (settlement.status !== "pending") {
      return res.status(400).json({ message: `Settlement already ${settlement.status}` });
    }

    settlement.status = "approved";
    await settlement.save();

    // ✅ Create corresponding transaction
    const transaction = new Transaction({
      groupId: settlement.groupId,
      payer: settlement.payer,
      payee: settlement.payee,
      amount: settlement.amount,
      type: "settlement",
    });
    await transaction.save();

    // ✅ Link settlement to all related expenses
    const relatedExpenses = await Expense.find({
      groupId: settlement.groupId,
      paidBy: settlement.payer,
      "splitBetween.userId": settlement.payee,
    });

    for (const exp of relatedExpenses) {
      if (!exp.settlements.includes(settlement._id)) {
        exp.settlements.push(settlement._id);
        await exp.save();
      }
    }

    res.json({
      message: "Settlement approved successfully",
      transaction,
      settlement,
      linkedExpenses: relatedExpenses.map((e) => e._id),
    });
  } catch (err) {
    console.error("Error approving settlement:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Reject a pending settlement
export const rejectSettlement = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const settlement = await Settlement.findById(id);
    if (!settlement) return res.status(404).json({ message: "Settlement not found" });

    if (settlement.payee.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to reject this settlement" });
    }

    if (settlement.status !== "pending") {
      return res.status(400).json({ message: `Settlement already ${settlement.status}` });
    }

    settlement.status = "rejected";
    await settlement.save();

    res.json({
      message: "Settlement rejected successfully",
      settlement,
    });
  } catch (err) {
    console.error("Error rejecting settlement:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Get pending offline settlements for current user
export const getPendingSettlements = async (req, res) => {
  try {
    const settlements = await Settlement.find({
      payee: req.user._id,
      status: "pending",
      paymentMode: "offline",
    })
      .populate("payer", "fullName")
      .populate("groupId", "name");

    const result = settlements.map((s) => ({
      _id: s._id,
      amount: s.amount,
      payerName: s.payer?.fullName || "Someone",
      groupName: s.groupId?.name || "a group",
      createdAt: s.createdAt,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching pending settlements:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};