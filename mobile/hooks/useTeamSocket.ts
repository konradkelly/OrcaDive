import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { useTeamStore } from "../store/teamStore";
import { useAgentStore } from "../store/agentStore";
import { useAuthStore } from "../store/authStore";

export function useTeamSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { updateMemberStatus } = useTeamStore();
  const { updateAgentStatus, addRun, updateRun } = useAgentStore();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    const API_URL = Constants.expoConfig?.extra?.API_URL ?? "http://localhost:3000";

    const socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socketRef.current = socket;

    // A team member posted a new status — update their card live
    socket.on("status:updated", ({ memberId, status, blockers }) => {
      updateMemberStatus(memberId, status, blockers);
    });

    // Agent status changed
    socket.on("agent:status_updated", ({ agentId, status }) => {
      updateAgentStatus(agentId, status);
    });

    // New agent run created
    socket.on("agent:run_created", ({ agentId, run }) => {
      addRun(agentId, run);
    });

    // Agent run updated (progress, completion)
    socket.on("agent:run_updated", ({ agentId, run }) => {
      updateRun(agentId, run);
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket connection failed:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return socketRef;
}
