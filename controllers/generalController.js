import Contact from "../models/Contact.js";
import nodemailer from "nodemailer";
import Feedback from "../models/Feedback.js";
// Configure transporter (yahan Gmail SMTP use kiya hai. Aap apni mail service ka use kar sakte hain)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.EMAIL_USER}`,        // apna email daalein
    pass: `${process.env.EMAIL_PASS}`,     // Gmail app password ya email password
  },
});

export const submitQuery = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newContact = new Contact({ name, email, message });
    await newContact.save();

    // Prepare confirmation email content
    const mailOptions = {
      from: `${process.env.EMAIL_USER}`, // sender address
      to: email,                                         // receiver (user's email)
      subject: "We received your query - SpliteIt Support",
      html: `
        <p>Hi ${name},</p>
        <p>Thank you for contacting SpliteIt! We have received your message and will try to resolve your query as soon as possible.</p>
        <p><strong>Your Message:</strong></p>
        <p>${message}</p>
        <br/>
        <p>Best regards,<br/>SpliteIt Support Team</p>
      `,
    };

    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending confirmation email:", error);
        // We don't want to fail the entire request if email fails, so continue
      } else {
        console.log("Confirmation email sent:", info.response);
      }
    });

    res.status(201).json({ message: "Query submitted successfully! Confirmation email sent." });
  } catch (error) {
    console.error("Error submitting query:", error);
    res.status(500).json({ message: "Something went wrong. Please try again later." });
  }
};
export const submitFeedback = async (req, res) => {
  const { feedback, rating } = req.body;

  if (!feedback || !rating) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const newFeedback = await Feedback.create({ feedback, rating });
    res.status(201).json({
      message: "Thank you for your feedback!",
      data: newFeedback,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to submit feedback", error: error.message });
  }
};

// (Optional) Get all feedbacks for admin
  export const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch feedbacks", error: error.message });
  }
};



