import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { statusRouter } from "./routes/status";
import { suggestRouter } from "./routes/suggest";
import { prRouter } from "./routes/prs";
import { authenticate } from "./middleware/authenticate";
import { registerSocketHandlers } from "./sockets/teamSocket";

const app = express();
const httpServer = createServer(app);

// Socket.io — attach to the same HTTP server
export const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// Public routes
app.use("/api/auth", authRouter);

// Protected routes — JWT required
app.use("/api/status", authenticate, statusRouter);
app.use("/api/ai", authenticate, suggestRouter);
app.use("/api/team", authenticate, prRouter);

// Agent routes — mixed auth (JWT for user-facing, API key for webhook endpoints)
// Webhook routes are mounted first without JWT — they use their own API key auth
import { agentWebhookRouter, agentUserRouter } from "./routes/agents";
app.use("/api/agents/webhook", agentWebhookRouter);
app.use("/api/agents", authenticate, agentUserRouter);

// WebSocket auth + event handlers
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing token"));
  // Reuse the same JWT verification as HTTP
  try {
    const jwt = require("jsonwebtoken");
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    (socket as any).userId = payload.userId;
    (socket as any).teamId = payload.teamId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket);
});

const PORT = process.env.PORT ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`OrcaDive server running on port ${PORT}`);
});
