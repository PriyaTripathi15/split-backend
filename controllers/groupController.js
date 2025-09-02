// routes/groupRoutes.js or controllers/groupController.js
import Group from "../models/Group.js";
import User from "../models/User.js"; // if needed
import mongoose from "mongoose";
import { sendInviteEmail } from "../utils/sendEmail.js";
import Expense from "../models/Expense.js"; // if needed
import Transaction from "../models/Transaction.js"; // if needed
import Settlement from "../models/Settlement.js";
import { notifyUserInvited } from "../utils/notifications.js"; // 🔔 import your notification helper
import { notifyGroupDeleted } from "../utils/notifications.js";


export const createGroup = async (req, res) => {
  try {
    const { name, membersEmails = [] } = req.body;
    const creatorId = req.user._id;
    const creatorEmail = req.user.email;

    const filteredInvites = membersEmails
      .map(email => email.trim().toLowerCase())
      .filter(email => email && email !== creatorEmail.toLowerCase());

    const members = [
      {
        userId: creatorId,
        role: "admin",
        status: "joined",
      },
    ];

    const group = new Group({
      name,
      members,
      invites: filteredInvites,
    });

    await group.save();

    // 🔔 Notify invited users if they exist
    const invitedUsers = await User.find({ email: { $in: filteredInvites } });

    await Promise.all(
      invitedUsers.map(user =>
        notifyUserInvited(user._id, name)
      )
    );

    res.status(201).json({ message: "Group created successfully", group });
  } catch (error) {
    console.error("Group creation error:", error);
    res.status(500).json({ message: "Failed to create group" });
  }
};




export const getMyGroups = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const groups = await Group.find({ "members.userId": userId })
      .populate("members.userId", "fullName email")
      .populate("expenses"); // optional

    res.status(200).json({ groups });
  } catch (error) {
    console.error("Error fetching groups:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    const group = await Group.findOne({
      _id: groupId,
      "members.userId": userId,
    }).populate("members.userId", "fullName email"); // optional: populate user details

    if (!group) {
      return res.status(404).json({ message: "Group not found or access denied" });
    }

    res.status(200).json({ group });
  } catch (error) {
    console.error("Error fetching group details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const addMemberToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Check if the user exists by email
    const user = await User.findOne({ email });

    // Check if user is already a member (if user exists)
    if (user) {
      const isMember = group.members.some(m => m.userId.equals(user._id));
      if (isMember) {
        return res.status(400).json({ message: "User already a member of this group" });
      }
    }

    // Check if email is already invited (pending)
    if (group.invites.includes(email)) {
      return res.status(400).json({ message: "User already invited (pending)" });
    }

    // Add email to invites list
    group.invites.push(email);
    await group.save();

    return res.status(200).json({ message: "User invited successfully", group });

  } catch (error) {
    console.error("Error adding invite:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const sendGroupInvites = async (req, res) => {
  const { groupId } = req.params;

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });

    if (!group.invites || group.invites.length === 0) {
      return res.status(400).json({ message: "No pending invites to send." });
    }

    const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const failedEmails = [];

    for (const email of group.invites) {
      const inviteLink = `${baseUrl}/group/join/${group._id}`;
      try {
        await sendInviteEmail({
          to: email,
          groupName: group.name,
          inviteLink,
        });
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err.message);
        failedEmails.push(email);
      }
    }

    if (failedEmails.length > 0) {
      return res.status(207).json({
        message: "Some invites failed to send.",
        failed: failedEmails,
      });
    }

    res.status(200).json({ message: "All invites sent successfully." });
  } catch (err) {
    console.error("Send Invites Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const joinGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;
  const userEmail = req.user.email.toLowerCase();

  try {
    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found." });

    // Already a member?
    const alreadyMember = group.members.some(
      (member) => member.userId.toString() === userId.toString()
    );
    if (alreadyMember) {
      return res.status(400).json({ message: "You are already a member of this group." });
    }

    // Invited?
    if (!group.invites.map(e => e.toLowerCase()).includes(userEmail)) {
      return res.status(403).json({ message: "You are not invited to join this group." });
    }

    // Add member with status joined
    group.members.push({ userId, role: "member", status: "joined" });

    // Remove user email from invites
    group.invites = group.invites.filter(
      (email) => email.toLowerCase() !== userEmail
    );

    await group.save();

    // Optional: Add this group to user's groups array
    await User.findByIdAndUpdate(userId, { $addToSet: { groups: group._id } });

    res.status(200).json({ message: "You have successfully joined the group." });
  } catch (err) {
    console.error("Join Group Error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



export const getGroupBalances = async (req, res) => {
  try {
    const groupId = req.params.groupId;

    // Step 1: Fetch group and members
    const group = await Group.findById(groupId).populate(
      "members.userId",
      "fullName email"
    );
    if (!group) return res.status(404).json({ message: "Group not found" });

    const userIds = group.members.map((m) => m.userId._id.toString());

    // Step 2: Initialize balances
    const balances = {};
    userIds.forEach((id) => {
      balances[id] = {};
      userIds.forEach((otherId) => {
        if (id !== otherId) balances[id][otherId] = 0;
      });
    });

    // Step 3: Fetch all expenses & settlements
    const expenses = await Expense.find({ groupId });
    const settlements = await Transaction.find({ groupId, type: "settlement" });

    // Step 4: Add expense splits
    for (const exp of expenses) {
      const payer = exp.paidBy.toString();
      for (const split of exp.splitBetween) {
        const payee = split.userId.toString();
        if (payer === payee) continue;
        balances[payee][payer] += split.amount;
      }
    }

    // Step 5: Subtract settled amounts
    for (const tx of settlements) {
      const payer = tx.payer.toString();
      const payee = tx.payee.toString();
      if (balances[payee]?.[payer] !== undefined) {
        balances[payee][payer] -= tx.amount;
        if (balances[payee][payer] < 0) balances[payee][payer] = 0;
      }
    }

    // Step 6: Build summary array
    const summary = [];
    userIds.forEach((fromId) => {
      userIds.forEach((toId) => {
        const amount = balances[fromId][toId];
        if (amount > 0.01) {
          const fromUser = group.members.find(
            (u) => u.userId._id.toString() === fromId
          );
          const toUser = group.members.find(
            (u) => u.userId._id.toString() === toId
          );

          summary.push({
            from: fromId,
            to: toId,
            amount: parseFloat(amount.toFixed(2)),
            fromName: fromUser ? fromUser.userId.fullName : "Unknown",
            toName: toUser ? toUser.userId.fullName : "Unknown",
          });
        }
      });
    });

    return res.json(summary);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error calculating balances" });
  }
};










export const deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user._id;

  try {
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const adminMember = group.members.find(
      (m) => m.userId.toString() === userId.toString() && m.role === "admin"
    );

    if (!adminMember) {
      return res.status(403).json({ message: "Only admin can delete the group" });
    }

    const transactions = await Transaction.find({ groupId });

    const balances = {};

    for (let tx of transactions) {
      const payerId = tx.payer.toString();
      const payeeId = tx.payee.toString();
      const amount = tx.amount;

      if (!balances[payerId]) balances[payerId] = {};
      if (!balances[payeeId]) balances[payeeId] = {};

      balances[payerId][payeeId] = (balances[payerId][payeeId] || 0) + amount;
      balances[payeeId][payerId] = (balances[payeeId][payerId] || 0) - amount;
    }

    const unsettled = Object.values(balances).some((userMap) =>
      Object.values(userMap).some((amt) => Math.abs(amt) > 0.01)
    );

    if (unsettled) {
      return res.status(400).json({
        message: "Group has unsettled payments. Settle up before deletion.",
      });
    }

    await Expense.deleteMany({ groupId });
    await Transaction.deleteMany({ groupId });
    await Settlement.deleteMany({ groupId });

    // 🔔 Notify all joined members
    const joinedMemberIds = group.members
      .filter(m => m.status === "joined")
      .map(m => m.userId);

    await Promise.all(
      joinedMemberIds.map(userId => notifyGroupDeleted(userId, group.name))
    );

    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("Error deleting group:", err);
    return res.status(500).json({ message: "Server error" });
  }
};







