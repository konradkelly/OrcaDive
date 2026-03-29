import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

type AuthStore = {
  token: string | null;
  userId: string | null;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  setToken: (token: string, userId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  userId: null,
  isLoading: true,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync("jwt");
    const userId = await SecureStore.getItemAsync("userId");
    set({ token, userId, isLoading: false });
  },

  setToken: async (token, userId) => {
    await SecureStore.setItemAsync("jwt", token);
    await SecureStore.setItemAsync("userId", userId);
    set({ token, userId });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync("jwt");
    await SecureStore.deleteItemAsync("userId");
    set({ token: null, userId: null });
  },
}));
