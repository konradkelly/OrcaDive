import { create } from "zustand";
import { api } from "../lib/api";

type PR = {
  id: string;
  title: string;
  repo: string;
  author: string;
  status: string;
  url: string;
  ageLabel: string;
};

type PRStore = {
  prs: PR[];
  isLoading: boolean;
  fetchPRs: () => Promise<void>;
};

export const usePRStore = create<PRStore>((set) => ({
  prs: [],
  isLoading: false,

  fetchPRs: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get("/team/prs");
      set({ prs: data.prs, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
