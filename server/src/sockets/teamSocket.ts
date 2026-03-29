import { Server, Socket } from "socket.io";

export function registerSocketHandlers(io: Server, socket: Socket) {
  const { userId, teamId } = socket as any;

  // Join the team room so broadcasts are scoped correctly
  socket.join(`team:${teamId}`);

  console.log(`User ${userId} joined team:${teamId}`);

  // Client requests to subscribe to a specific agent's run updates
  socket.on("agent:subscribe", (agentId: string) => {
    socket.join(`agent:${agentId}`);
  });

  socket.on("agent:unsubscribe", (agentId: string) => {
    socket.leave(`agent:${agentId}`);
  });

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
}
