export const registerSocketHandlers = (socket, io) => {
  // 👇 This will handle when a new notification is triggered for a user
  socket.on("send-notification", ({ recipientId, notification }) => {
    console.log(`🔔 Emitting notification to user ${recipientId}`);

    io.to(recipientId).emit("receive-notification", notification);
  });

  // You can extend this for other real-time features like chat, typing, etc.
};