import { create } from "zustand";
import { api } from "../lib/api";

type Agent = {
  id: string;
  name: string;
  type: "custom" | "copilot" | "ci";
  avatar_url: string | null;
  status: "idle" | "running" | "error" | "offline";
  last_seen: string | null;
  created_at: string;
};

type AgentRun = {
  id: string;
  task: string;
  status: "pending" | "running" | "success" | "failure" | "cancelled";
  output: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type AgentStore = {
  agents: Agent[];
  runs: Record<string, AgentRun[]>;  // keyed by agentId
  isLoading: boolean;

  fetchAgents: () => Promise<void>;
  fetchRuns: (agentId: string) => Promise<void>;
  assignTask: (agentId: string, task: string) => Promise<void>;
  cancelRun: (agentId: string, runId: string) => Promise<void>;

  // Called by socket events
  updateAgentStatus: (agentId: string, status: Agent["status"]) => void;
  addRun: (agentId: string, run: AgentRun) => void;
  updateRun: (agentId: string, run: Partial<AgentRun> & { id: string }) => void;
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  runs: {},
  isLoading: false,

  fetchAgents: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/agents");
      set({ agents: data.agents, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchRuns: async (agentId) => {
    try {
      const { data } = await api.get(`/agents/${agentId}/runs`);
      set((state) => ({
        runs: { ...state.runs, [agentId]: data.runs },
      }));
    } catch {
      // fail silently
    }
  },

  assignTask: async (agentId, task) => {
    const { data } = await api.post(`/agents/${agentId}/runs`, { task });
    set((state) => ({
      runs: {
        ...state.runs,
        [agentId]: [data.run, ...(state.runs[agentId] ?? [])],
      },
    }));
  },

  cancelRun: async (agentId, runId) => {
    await api.post(`/agents/${agentId}/runs/${runId}/cancel`);
  },

  updateAgentStatus: (agentId, status) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, status, last_seen: new Date().toISOString() } : a
      ),
    }));
  },

  addRun: (agentId, run) => {
    set((state) => ({
      runs: {
        ...state.runs,
        [agentId]: [run, ...(state.runs[agentId] ?? [])],
      },
    }));
  },

  updateRun: (agentId, run) => {
    set((state) => ({
      runs: {
        ...state.runs,
        [agentId]: (state.runs[agentId] ?? []).map((r) =>
          r.id === run.id ? { ...r, ...run } : r
        ),
      },
    }));
  },
}));
