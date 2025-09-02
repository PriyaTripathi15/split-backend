import Expense from "../models/Expense.js";
import Transaction from "../models/Transaction.js";
import Group from "../models/Group.js";
import User from "../models/User.js";
import {
  notifyExpenseAdded
} from "../utils/notifications.js";
import Settlement from "../models/Settlement.js";// 🔔 import your notification helper

export const addExpense = async (req, res) => {
  try {
    const { groupId } = req.params;
    const {
      description,
      participants,
      amount,
      splitType,
      date,
      category,
    } = req.body;

    const paidBy = req.user._id; // ✅ logged-in user only

    if (
      !groupId ||
      !description ||
      !amount ||
      !participants ||
      participants.length === 0 ||
      !splitType ||
      !category
    ) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    let splitBetween = [];

    if (splitType === "equal") {
      const share = parseFloat((amount / participants.length).toFixed(2));
      splitBetween = participants.map(({ userId }) => ({
        userId,
        amount: share,
      }));
    } else if (splitType === "exact") {
      const totalExact = participants.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
      if (Math.abs(totalExact - amount) > 0.01) {
        return res
          .status(400)
          .json({ message: "Exact amounts do not sum to total." });
      }
      splitBetween = participants.map(({ userId, amount }) => ({
        userId,
        amount: parseFloat(amount),
      }));
    } else if (splitType === "percentage") {
      const totalPercent = participants.reduce(
        (sum, p) => sum + parseFloat(p.percentage),
        0
      );
      if (Math.abs(totalPercent - 100) > 0.01) {
        return res
          .status(400)
          .json({ message: "Percentages do not sum to 100." });
      }
      splitBetween = participants.map(({ userId, percentage }) => ({
        userId,
        amount: parseFloat(((percentage / 100) * amount).toFixed(2)),
        percentage: parseFloat(percentage),
      }));
    } else {
      return res.status(400).json({ message: "Invalid split type." });
    }

    // ✅ Create Expense
    const expense = new Expense({
      groupId,
      description,
      amount,
      paidBy,
      splitType,
      category,
      splitBetween,
      createdAt: date || new Date(),
    });

    await expense.save();

    // ✅ Create Transactions
    const transactions = splitBetween
      .filter(({ userId }) => userId.toString() !== paidBy.toString())
      .map(({ userId, amount }) => ({
        groupId,
        payer: paidBy,
        payee: userId,
        amount,
        type: "expense",
        expenseId: expense._id,
      }));

    if (transactions.length > 0) {
      await Transaction.insertMany(transactions);
    }

    // ✅ Notifications
    const group = await Group.findById(groupId);
    const groupName = group?.name || "a group";
    const addedByName = req.user.fullName;

    const notifyList = splitBetween
      .filter(({ userId }) => userId.toString() !== paidBy.toString())
      .map(({ userId }) => notifyExpenseAdded(userId, addedByName, groupName));

    await Promise.all(notifyList);

    return res
      .status(201)
      .json({ message: "Expense added successfully", expense });
  } catch (error) {
    console.error("Add expense error:", error);
    return res
      .status(500)
      .json({ message: "Server error while adding expense." });
  }
};


export const getGroupExpenses = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    const expenses = await Expense.find({ groupId })
      .populate("paidBy", "fullName _id")
      .populate("splitBetween.userId", "fullName _id")
      .sort({ createdAt: -1 });

    const formattedExpenses = await Promise.all(
      expenses.map(async (exp) => {
        const paidByMe = exp.paidBy._id.toString() === userId.toString();

        // calculate unsettled amount per member
        const updatedSplitBetween = await Promise.all(
          exp.splitBetween.map(async (member) => {
            let unsettledAmount = member.amount;

            const settledTransactions = await Settlement.find({
              expenseId: exp._id,
              status: "success",
              $or: [
                { payer: member.userId._id, payee: exp.paidBy._id },
                { payer: exp.paidBy._id, payee: member.userId._id },
              ],
            });

            settledTransactions.forEach((s) => {
              unsettledAmount -= s.amount;
            });

            return {
              ...member._doc,
              unsettledAmount: parseFloat(unsettledAmount.toFixed(2)),
            };
          })
        );

        return {
          _id: exp._id,
          description: exp.description,
          amount: exp.amount,
          paidBy: exp.paidBy,
          createdAt: exp.createdAt,
          splitBetween: updatedSplitBetween,
          paidByMe,
        };
      })
    );

    res.status(200).json({ expenses: formattedExpenses });
  } catch (error) {
    console.error("Error fetching group expenses:", error);
    res.status(500).json({ message: "Failed to fetch expenses", error });
  }
};


export const getBalanceSummary = async (req, res) => {
  const userId = req.user._id;

  try {
    // 1️⃣ Fetch all expenses in the group(s) where the user is involved
    const expenses = await Expense.find({
      $or: [{ paidBy: userId }, { "splitBetween.userId": userId }],
    }).populate("paidBy", "fullName _id");

    // 2️⃣ Fetch all settlements related to the user
    const settlements = await Settlement.find({
      $or: [{ payer: userId }, { payee: userId }],
      status: "success",
    });

    // 3️⃣ Calculate net balance per user
    const balanceMap = {}; // { otherUserId: netAmount }

    expenses.forEach((exp) => {
      const paidByMe = exp.paidBy._id.toString() === userId.toString();

      exp.splitBetween.forEach((member) => {
        const memberId = member.userId._id.toString();
        if (memberId === userId.toString()) return; // skip self

        if (!balanceMap[memberId]) balanceMap[memberId] = 0;

        const share = member.amount;

        if (paidByMe) {
          // I paid, others owe me
          balanceMap[memberId] += share;
        } else if (memberId === member.userId._id.toString()) {
          // Other paid, I owe them
          balanceMap[exp.paidBy._id] = (balanceMap[exp.paidBy._id] || 0) - share;
        }
      });
    });

    // 4️⃣ Subtract settlements
    settlements.forEach((s) => {
      const payer = s.payer.toString();
      const payee = s.payee.toString();
      const amount = s.amount;

      if (payer === userId) {
        // I paid to someone -> reduce their debt to me
        balanceMap[payee] = (balanceMap[payee] || 0) - amount;
      } else if (payee === userId) {
        // Someone paid me -> reduce my debt to them
        balanceMap[payer] = (balanceMap[payer] || 0) + amount;
      }
    });

    // 5️⃣ Format the output
    const result = [];
    for (const [otherUserId, netAmount] of Object.entries(balanceMap)) {
      if (Math.abs(netAmount) > 0.01) {
        result.push({
          userId: otherUserId,
          balance: parseFloat(netAmount.toFixed(2)),
          owesYou: netAmount > 0,
        });
      }
    }

    res.status(200).json({ balances: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to calculate balance" });
  }
};


export const getMyExpenseSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch expenses where user is involved
    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { 'splitBetween.userId': userId }
      ]
    }).populate("settlements"); // populate settlements

    let totalSpent = 0;         // You paid in any expense
    let myExpense = 0;          // Your own share that you settled
    let myActiveExpenses = 0;   // Your own share not settled yet
    let totalReceived = 0;      // Others’ shares settled to you
    let pendingFromOthers = 0;  // Others’ shares not yet settled

    for (const exp of expenses) {
      const paidByMe = exp.paidBy.toString() === userId.toString();

      if (paidByMe) totalSpent += exp.amount;

      for (const member of exp.splitBetween) {
        const isMe = member.userId.toString() === userId.toString();

        // Check if this member's share is settled
        let isSettled = false;
        if (exp.settlements && exp.settlements.length > 0) {
          isSettled = exp.settlements.some(s => 
            s.status === "success" &&
            ((s.payer.toString() === userId.toString() && s.payee.toString() === exp.paidBy.toString()) ||
             (s.payee.toString() === userId.toString() && s.payer.toString() === exp.paidBy.toString()))
          );
        }

        // My settled expense
        if (isMe && (paidByMe || isSettled)) myExpense += member.amount;

        // My active expense (not settled yet)
        if (isMe && !isSettled) myActiveExpenses += member.amount;

        // Others’ shares
        if (paidByMe && !isMe && isSettled) totalReceived += member.amount;
        if (paidByMe && !isMe && !isSettled) pendingFromOthers += member.amount;
      }
    }

    res.status(200).json({
      summary: { totalSpent, myExpense, myActiveExpenses, totalReceived, pendingFromOthers }
    });

  } catch (error) {
    console.error("Error in getMyExpenseSummary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};












export const getFullExpenses = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all expenses involving the user
    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { "splitBetween.userId": userId },
      ],
    })
      .populate("paidBy", "fullName")
      .populate("groupId", "name")
      .populate({
        path: "settlements",
        match: { status: "success" }, // only successful settlements
      })
      .sort({ createdAt: -1 });

    const formattedExpenses = expenses.map((exp) => {
      const currentUserId = String(userId);
      const paidByMe = String(exp.paidBy._id) === currentUserId;

      // Find split info for current user
      const splitInfo = exp.splitBetween.find(
        (s) => String(s.userId._id || s.userId) === currentUserId
      );

      // Check if current user's share is settled
      let isSettled = false;
      let settlementDetails = null;

      if (exp.settlements && exp.settlements.length > 0) {
        const relevantSettlement = exp.settlements.find(
          (s) =>
            (String(s.payer) === currentUserId && String(s.payee) === exp.paidBy._id.toString()) ||
            (String(s.payee) === currentUserId && String(s.payer) === exp.paidBy._id.toString())
        );

        if (relevantSettlement) {
          isSettled = true;
          settlementDetails = {
            status: relevantSettlement.status,
            paymentMode: relevantSettlement.paymentMode,
            receiptLink: relevantSettlement.receiptLink || null,
            paymentId: relevantSettlement.paymentId || null,
            settledAt: relevantSettlement.createdAt,
            amount: relevantSettlement.amount,
            payer: relevantSettlement.payer,
            payee: relevantSettlement.payee,
          };
        }
      }

      return {
        _id: exp._id,
        description: exp.description,
        amount: exp.amount,
        paidBy: exp.paidBy,
        group: exp.groupId,
        splitType: exp.splitType,
        splitBetween: exp.splitBetween,
        category: exp.category,
        createdAt: exp.createdAt,
        updatedAt: exp.updatedAt,
        isSettled,
        settlementDetails,
        paidByMe,
      };
    });

    res.json({ expenses: formattedExpenses });
  } catch (error) {
    console.error("Error fetching expenses", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



export const getMyGroupExpenseSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { "splitBetween.userId": userId },
      ]
    })
      .populate("groupId", "name")
      .populate({
        path: "settlements",
        match: { status: "success" }, // only settled
      });

    const summaryMap = {};

    expenses.forEach((exp) => {
      const groupId = exp.groupId?._id?.toString();
      if (!groupId) return;

      if (!summaryMap[groupId]) {
        summaryMap[groupId] = { groupName: exp.groupId.name || "Unknown Group", paid: 0, received: 0 };
      }

      const paidByMe = exp.paidBy.toString() === userId.toString();

      // 1️⃣ Direct expense paid by me
      if (paidByMe) {
        summaryMap[groupId].paid += exp.amount;
      }

      // 2️⃣ My share from splitBetween
      exp.splitBetween.forEach((member) => {
        const isMe = member.userId.toString() === userId.toString();

        if (isMe) {
          // If current user is payer, ignore
          if (!paidByMe) {
            summaryMap[groupId].received += member.amount;
          }
        }
      });

      // 3️⃣ Settlements
      if (exp.settlements && exp.settlements.length > 0) {
        exp.settlements.forEach((s) => {
          if (s.payer?.toString() === userId.toString()) {
            summaryMap[groupId].paid += s.amount;
          } else if (s.payee?.toString() === userId.toString()) {
            summaryMap[groupId].received += s.amount;
          }
        });
      }
    });

    const result = Object.entries(summaryMap).map(([groupId, data]) => ({
      groupId,
      groupName: data.groupName,
      paid: data.paid,
      received: data.received,
      balance: data.paid - data.received,
    }));

    res.status(200).json(result);
  } catch (error) {
    console.error("Error in getMyGroupExpenseSummary:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};









