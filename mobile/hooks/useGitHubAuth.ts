import { useEffect, useMemo, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import type { DiscoveryDocument } from "expo-auth-session";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";

WebBrowser.maybeCompleteAuthSession();

const GITHUB_CLIENT_ID = Constants.expoConfig?.extra?.GITHUB_CLIENT_ID ?? "";

/** Must match a URL registered on the GitHub OAuth App → Authorization callback URL (e.g. orcadive://auth). */
const githubDiscovery: DiscoveryDocument = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
};

export function useGitHubAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setToken } = useAuthStore();
  const router = useRouter();

  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: "orcadive",
        path: "auth",
      }),
    []
  );

  useEffect(() => {
    if (__DEV__) {
      console.log(
        "[GitHub OAuth] Add this exact URL as an Authorization callback URL on your GitHub OAuth App:",
        redirectUri
      );
    }
  }, [redirectUri]);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GITHUB_CLIENT_ID,
      scopes: ["read:user", "repo"],
      redirectUri,
    },
    githubDiscovery
  );

  const signIn = async () => {
    if (!request || !GITHUB_CLIENT_ID) {
      setError("GitHub sign-in is not configured (missing GITHUB_CLIENT_ID).");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await promptAsync();

      if (result.type === "cancel" || result.type === "dismiss") {
        return;
      }

      if (result.type === "error") {
        const msg =
          (result.params.error_description as string | undefined) ||
          (result.params.error as string | undefined) ||
          "Authorization failed";
        setError(msg);
        return;
      }

      if (result.type !== "success") {
        setError("Sign in was not completed.");
        return;
      }

      const code =
        typeof result.params.code === "string" ? result.params.code : null;
      if (!code) {
        setError("No authorization code returned from GitHub.");
        return;
      }

      const codeVerifier = request.codeVerifier;

      const { data } = await api.post("/auth/github", {
        code,
        redirectUri,
        codeVerifier,
      });
      await setToken(data.token, data.userId);
      router.replace("/(tabs)/dashboard");
    } catch (err: unknown) {
      console.error("Auth error:", err);
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    error,
    isReady: !!request && !!GITHUB_CLIENT_ID,
  };
}
