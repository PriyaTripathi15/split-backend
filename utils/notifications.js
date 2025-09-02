import Notification from "../models/Notification.js";

export const createNotification = async (userId, message, type = "info", meta = {}) => {
  try {
    const notification = new Notification({ user: userId, message });
    await notification.save();

    if (global._io) {
      console.log(`📤 Emitting real-time notification to user: ${userId.toString()}`);
      global._io.to(userId.toString()).emit("receive-notification", {
        message,
        timestamp: notification.createdAt,
        _id: notification._id,
        type,
        ...meta,
      });
    } else {
      console.warn("⚠️ global._io is undefined. Notification not emitted.");
    }
  } catch (err) {
    console.error("Notification creation error:", err);
  }
};

export const notifyUserInvited = async (userId, groupName) => {
  await createNotification(userId, `You’ve been invited to join the group ${groupName}.`);
};

export const notifyExpenseAdded = async (userId, addedByName, groupName) => {
  await createNotification(userId, `${addedByName} added a new expense in ${groupName}.`);
};

export const notifySettlement = async (userId, fromUser, toUser, groupName) => {
  await createNotification(userId, `${fromUser} settled up with ${toUser} in ${groupName} group.`);
};

export const notifyGroupDeleted = async (userId, groupName) => {
  await createNotification(userId, `The group ${groupName} was deleted by the admin.`);
};

export const notifyOfflineSettlementRequest = async (userId, fromUser, groupName, settlementId) => {
  const message = `${fromUser} wants to settle up with you offline in group "${groupName}". Approve or reject the request.`;
  await createNotification(userId, message, "offline-settlement", { settlementId });
};
