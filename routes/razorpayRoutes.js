import express from "express";
import {
  createOrder,
  verifyAndSettle,
} from "../controllers/razorpayController.js";
import  protect from "../middleware/authMiddleware.js"; // if you use JWT

const router = express.Router();

router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyAndSettle);

export default router;
