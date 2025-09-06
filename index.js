
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import generalRoutes from './routes/generalRoutes.js';
import noticationRoutes from './routes/notificationRoutes.js';
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

app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*",credentials:true }, // Set frontend origin for security
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
app.use(cors({
  origin: '*', // or your frontend origin
  credentials: true,
}));

global._io = io;




app.use('/api/chat',chatRoutes);
app.use('/api/auth', authRoutes);
app.use("/api/groups", groupRoutes);
app.use('/api/transaction', transactionRoutes);
app.use('/api/general', generalRoutes);
app.use('/api/expense', expenseRoutes);
app.use("/api/stripe", stripeRoutes);
app.use('/api/notification', noticationRoutes);
app.use('/api/stats',statsRoutes);

app.get('/', (req, res) => {
   res.status(200).json({
    message: "Welcome to the SplitIt API"
   })
})

io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  // Join user room
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`✅ User ${userId} joined their room`);
  });

  registerSocketHandlers(socket, io); // Optional: structure handlers
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => console.log(err));


server.listen(5000, () => console.log('🚀 Server + Socket.IO running on port 5000'));
