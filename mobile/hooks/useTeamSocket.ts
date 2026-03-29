import { useEffect, useRef } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import Constants from "expo-constants";
import { useTeamStore } from "../store/teamStore";
import { useAgentStore } from "../store/agentStore";
import { useAuthStore } from "../store/authStore";

// React Native needs a TextEncoder polyfill for @stomp/stompjs
import "text-encoding-polyfill";

export function useTeamSocket() {
  const clientRef = useRef<Client | null>(null);
  const { updateMemberStatus } = useTeamStore();
  const { updateAgentStatus, addRun, updateRun } = useAgentStore();
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    const API_URL =
      Constants.expoConfig?.extra?.API_URL ?? "http://localhost:3000";
    const wsUrl = API_URL.replace(/^http/, "ws") + "/ws/websocket";

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { token },
      reconnectDelay: 5000,
      onConnect: () => {
        // Decode the JWT to read teamId (payload is the second base64 segment)
        const payload = JSON.parse(atob(token.split(".")[1]));
        const teamId = payload.teamId;

        // A team member posted a new status — update their card live
        client.subscribe(
          `/topic/team.${teamId}.status`,
          (msg: IMessage) => {
            const { memberId, status, blockers } = JSON.parse(msg.body);
            updateMemberStatus(memberId, status, blockers);
          },
        );

        // Agent status changed
        client.subscribe(
          `/topic/team.${teamId}.agent.status`,
          (msg: IMessage) => {
            const { agentId, status } = JSON.parse(msg.body);
            updateAgentStatus(agentId, status);
          },
        );

        // New agent run created
        client.subscribe(
          `/topic/team.${teamId}.agent.run.created`,
          (msg: IMessage) => {
            const { agentId, run } = JSON.parse(msg.body);
            addRun(agentId, run);
          },
        );

        // Agent run updated (progress, completion)
        client.subscribe(
          `/topic/team.${teamId}.agent.run.updated`,
          (msg: IMessage) => {
            const { agentId, run } = JSON.parse(msg.body);
            updateRun(agentId, run);
          },
        );
      },
      onStompError: (frame) => {
        console.warn("STOMP error:", frame.headers["message"]);
      },
      onWebSocketError: (event) => {
        console.warn("WebSocket connection failed:", event);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
    };
  }, [token]);

  return clientRef;
}
