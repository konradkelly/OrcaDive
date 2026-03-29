import { useState } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";

// Needed so the browser dismisses correctly on iOS
WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = Constants.expoConfig?.extra?.GITHUB_CLIENT_ID ?? "";

const discovery = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

export function useGitHubAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setToken } = useAuthStore();

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "teamradar" });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ["read:user", "repo"],
      redirectUri,
    },
    discovery
  );

  const signIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await promptAsync();

      if (result.type !== "success") {
        setError("Sign in was cancelled");
        setIsLoading(false);
        return;
      }

      const { code } = result.params;

      // Exchange the GitHub code for our JWT via the backend
      const { data } = await api.post("/auth/github", { code });
      await setToken(data.token, data.userId);
    } catch (err) {
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, isLoading, error, isReady: !!request };
}
