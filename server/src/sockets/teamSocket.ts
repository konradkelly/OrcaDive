import { Server, Socket } from "socket.io";

export function registerSocketHandlers(io: Server, socket: Socket) {
  const { userId, teamId } = socket as any;

  // Join the team room so broadcasts are scoped correctly
  socket.join(`team:${teamId}`);

  console.log(`User ${userId} joined team:${teamId}`);

  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected`);
  });
}
