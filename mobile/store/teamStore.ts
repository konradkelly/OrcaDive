import { create } from "zustand";
import { api } from "../lib/api";

type Member = {
  id: string;
  name: string;
  avatar: string;
  status: string;
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
  updateMemberStatus: (memberId: string, status: string, blockers: string | null) => void;
};

export const useTeamStore = create<TeamStore>((set) => ({
  members: [],
  myLastStatus: null,
  isLoading: false,

  fetchTeam: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/team/status");
      set({ members: data.members, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  // Called by the WebSocket hook when a live update arrives
  updateMemberStatus: (memberId, status, blockers) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId
          ? { ...m, status, blockers, updatedToday: true, updatedAt: new Date().toISOString() }
          : m
      ),
    }));
  },
}));
