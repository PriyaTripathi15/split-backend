import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPayment = async (req, res) => {
  try {
    const { amount, payerEmail, payerName, currency = "INR" } = req.body;

    // ✅ Validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount provided." });
    }
    if (!payerEmail || !payerName) {
      return res.status(400).json({ success: false, message: "Payer details missing." });
    }

    
    // ✅ Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to paise
      currency,
      receipt_email: payerEmail,
      payment_method_types: ["card"],
      metadata: { payerName },
    });

    return res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe createPayment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment intent.",
      error: err.message,
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: "PaymentIntent ID is required." });
    }

    const paymentIntent = 
    await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      return res.status(200).json({ success: true, data: paymentIntent });
    }

    return res.status(200).json({
      success: false,
      message: "Payment not completed yet",
      status: paymentIntent.status,
    });
  } catch (err) {
    console.error("Stripe verifyPayment Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment.",
      error: err.message,
    });
  }
};
