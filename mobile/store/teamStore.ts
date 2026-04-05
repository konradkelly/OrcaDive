import { create } from "zustand";
import { api } from "../lib/api";

type Member = {
  id: string;
  kind: "user" | "agent";
  name: string;
  avatar: string | null;
  status: string | null;
  blockers: string | null;
  updatedToday: boolean;
  updatedAt: string;
  openPRs: number;
};

type TeamStore = {
  members: Member[];
  myLastStatus: string | null;
  isLoading: boolean;
  fetchTeam: () => Promise<void>;
  updateMemberStatus: (payload: {
    memberId?: string;
    agentId?: string;
    status: string;
    blockers: string | null;
  }) => void;
};

export const useTeamStore = create<TeamStore>((set) => ({
  members: [],
  myLastStatus: null,
  isLoading: false,

  fetchTeam: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/status/team");
      set({ members: data.members, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateMemberStatus: ({ memberId, agentId, status, blockers }) => {
    const targetKind = memberId ? "user" : "agent";
    const id = memberId ?? agentId;
    if (!id) return;

    set((state) => ({
      members: state.members.map((m) =>
        m.id === id && m.kind === targetKind
          ? {
              ...m,
              status,
              blockers,
              updatedToday: true,
              updatedAt: new Date().toISOString(),
            }
          : m
      ),
    }));
  },
}));
