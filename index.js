import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import generalRoutes from './routes/generalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import stripeRoutes from "./routes/stripeRoutes.js";
import statsRoutes from './routes/statsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { config } from 'dotenv';
import { registerSocketHandlers } from "./utils/sockets/socketHandlers.js";
import http from "http";
import { Server } from "socket.io";

config();
const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "https://split-frontend-nah2.vercel.app";
const LOCAL_DEV_URL = process.env.LOCAL_DEV_URL || "http://localhost:5173";

const allowedOrigins = [FRONTEND_URL, LOCAL_DEV_URL];

app.use(express.json());

// Configure CORS for HTTP routes
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman) or from whitelist
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS error: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Socket.IO setup with CORS guard
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Initialize AI (if needed)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Route definitions
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/general', generalRoutes);
app.use('/api/expense', expenseRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/notification', notificationRoutes);
app.use('/api/stats', statsRoutes);

app.get('/', (req, res) => {
  res.status(200).json({ message: "Welcome to the SplitIt API" });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} joined their room`);
  });

  registerSocketHandlers(socket, io);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server + Socket.IO running on port ${PORT}`));
