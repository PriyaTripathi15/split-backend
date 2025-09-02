import mongoose from 'mongoose';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';

export const getUserExpenseStats = async (req, res) => {
  try {
    const { userId: uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userId = new mongoose.Types.ObjectId(uid);
    const expenses = await Expense.find({ 'splitBetween.userId': userId }).populate('groupId');

    let totalSpent = 0;
    const categoryMap = {};
    const groupMap = {};

    expenses.forEach(exp => {
      exp.splitBetween.forEach(s => {
        if (s.userId.toString() === uid) {
          totalSpent += s.amount;
          categoryMap[exp.category] = (categoryMap[exp.category] || 0) + s.amount;
          const groupName = exp.groupId?.name || 'Unknown';
          groupMap[groupName] = (groupMap[groupName] || 0) + s.amount;
        }
      });
    });

    res.json({
      totalSpent,
      totalExpenses: expenses.length,
      totalGroups: Object.keys(groupMap).length,
      categoryBreakdown: categoryMap,
      groupBreakdown: groupMap,
    });
  } catch (err) {
    console.error("❌ Error in getUserExpenseStats:", err);
    res.status(500).json({ message: "Error fetching stats", error: err.message });
  }
};

export const getMonthlyTrend = async (req, res) => {
  try {
    const { userId: uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userId = new mongoose.Types.ObjectId(uid);
    const expenses = await Expense.find({ 'splitBetween.userId': userId });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const currentYear = new Date().getFullYear();
    const monthlyTotals = {};

    // Initialize all months with 0
    monthNames.forEach(month => {
      monthlyTotals[month] = 0;
    });

    expenses.forEach(exp => {
      const date = new Date(exp.createdAt);
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();

      if (year === currentYear) {
        exp.splitBetween.forEach(s => {
          if (s.userId.toString() === uid) {
            monthlyTotals[month] += s.amount;
          }
        });
      }
    });

    const result = monthNames.map((month) => ({
      name: month,
      spent: monthlyTotals[month]
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Error in getMonthlyTrend:", err);
    res.status(500).json({ message: "Error", error: err.message });
  }
};

export const getPaidVsOwed = async (req, res) => {
  try {
    const { userId: uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userId = new mongoose.Types.ObjectId(uid);
    const expenses = await Expense.find({
      $or: [
        { 'splitBetween.userId': userId },
        { paidBy: userId }
      ]
    });

    let paid = 0, owed = 0;

    expenses.forEach(exp => {
      if (exp.paidBy.toString() === uid) paid += exp.amount;
      exp.splitBetween.forEach(s => {
        if (s.userId.toString() === uid) owed += s.amount;
      });
    });

    res.json([
      { name: 'Paid', value: paid },
      { name: 'Owed', value: owed }
    ]);
  } catch (err) {
    console.error("❌ Error in getPaidVsOwed:", err);
    res.status(500).json({ message: "Error", error: err.message });
  }
};

export const getCategorySummary = async (req, res) => {
  try {
    const { userId: uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userId = new mongoose.Types.ObjectId(uid);
    const expenses = await Expense.find({ 'splitBetween.userId': userId });

    const categories = {};
    expenses.forEach(exp => {
      exp.splitBetween.forEach(s => {
        if (s.userId.toString() === uid) {
          categories[exp.category] = (categories[exp.category] || 0) + s.amount;
        }
      });
    });

    const result = Object.entries(categories).map(([name, value]) => ({ name, value }));
    res.json(result);
  } catch (err) {
    console.error("❌ Error in getCategorySummary:", err);
    res.status(500).json({ message: "Error", error: err.message });
  }
};

export const getGroupWiseSummary = async (req, res) => {
  try {
    const { userId: uid } = req.params;

    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const userId = new mongoose.Types.ObjectId(uid);
    const expenses = await Expense.find({ 'splitBetween.userId': userId }).populate('groupId');

    const groups = {};
    expenses.forEach(exp => {
      const group = exp.groupId?.name || 'Unknown';
      exp.splitBetween.forEach(s => {
        if (s.userId.toString() === uid) {
          groups[group] = (groups[group] || 0) + s.amount;
        }
      });
    });

    const result = Object.entries(groups).map(([name, value]) => ({ name, value }));
    res.json(result);
  } catch (err) {
    console.error("❌ Error in getGroupWiseSummary:", err);
    res.status(500).json({ message: "Error", error: err.message });
  }
};
