import axios from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API_URL = Constants.expoConfig?.extra?.API_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 10000,
});

// Inject JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("jwt");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
