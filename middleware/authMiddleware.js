import jwt from "jsonwebtoken";
import User from "../models/User.js"; // Make sure this is the correct path

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = user; // ✅ Now req.user.id or req.user._id is available
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

export default protect;
