import razorpay from "../utils/razorpay.js"; // your Razorpay instance
import Settlement from "../models/Settlement.js";
import crypto from "crypto";
export const createOrder = async (req, res) => {
  try {
    let { amount } = req.body;

    // Convert to number and round off to integer paise value
    const amountInPaise = Math.round(Number(amount) * 100);

    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const options = {
      amount: amountInPaise, // must be integer in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(201).json(order);
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ message: "Failed to create Razorpay order" });
  }
};


export const verifyAndSettle = async (req, res) => {
  try {
    const {
      groupId,
      payer,
      payee,
      amount,
      paymentMode = "razorpay",
      paymentId,
      orderId,
      signature,
    } = req.body;

    // Basic validations
    if (
      !groupId || !payer || !payee ||
      !paymentId || !orderId || !signature ||
      typeof amount !== "number" || amount <= 0
    ) {
      return res.status(400).json({ message: "Invalid or missing fields" });
    }

    // Verify Razorpay signature
    const body = `${orderId}|${paymentId}`;

    const secret = process.env.RAZORPAY_KEY_SECRET;
if (!secret) {
  throw new Error("RAZORPAY_KEY_SECRET is not defined");
}
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: "Invalid Razorpay signature" });
    }

    // Create settlement entry
    const settlement = await Settlement.create({
      groupId,
      payer,
      payee,
      amount,
      paymentMode,
      paymentId,
      orderId,
      signature,
      status: "success",
      createdBy: payer,
    });

    res.status(200).json({ message: "Payment recorded", settlement });
  } catch (err) {
    console.error("Settlement error:", err);
    res.status(500).json({ message: "Failed to settle payment" });
  }
};