import express from "express";
import { getUserNotifications, markAsRead, deleteNotification,getUnreadCount } from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getUserNotifications);
router.put("/mark-read", authMiddleware, markAsRead);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.delete("/:id", authMiddleware, deleteNotification);

export default router;