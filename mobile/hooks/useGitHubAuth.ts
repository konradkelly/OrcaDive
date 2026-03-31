import { useState, useRef, useCallback } from "react";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";

const GITHUB_CLIENT_ID = Constants.expoConfig?.extra?.GITHUB_CLIENT_ID ?? "";
const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

export function useGitHubAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const { setToken } = useAuthStore();
  const router = useRouter();
  const cancelRef = useRef(false);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setIsLoading(false);
    setUserCode(null);
  }, []);

  const signIn = async () => {
    setIsLoading(true);
    setError(null);
    setUserCode(null);
    cancelRef.current = false;

    try {
      // Step 1: Request device + user codes
      const codeRes = await fetch(DEVICE_CODE_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          scope: "read:user repo",
        }),
      });
      const codeData = await codeRes.json();

      if (codeData.error) {
        setError(codeData.error_description || codeData.error);
        setIsLoading(false);
        return;
      }

      const { device_code, user_code, verification_uri, interval = 5 } = codeData;
      setUserCode(user_code);

      // Open the verification page in the browser
      WebBrowser.openBrowserAsync(verification_uri);

      // Step 2: Poll for the access token
      const accessToken = await pollForToken(device_code, interval);
      if (!accessToken) return; // cancelled or error already set

      // Step 3: Exchange GitHub token for our JWT via the backend
      const { data } = await api.post("/auth/github/token", { accessToken });
      await setToken(data.token, data.userId);
      setUserCode(null);
      router.replace("/(tabs)/dashboard");
    } catch (err: any) {
      console.error("Auth error:", err?.response?.data ?? err?.message ?? err);
      setError("Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const pollForToken = async (deviceCode: string, interval: number): Promise<string | null> => {
    while (!cancelRef.current) {
      await new Promise((r) => setTimeout(r, interval * 1000));
      if (cancelRef.current) return null;

      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      });
      const data = await res.json();

      if (data.access_token) return data.access_token;

      if (data.error === "authorization_pending") continue;
      if (data.error === "slow_down") {
        interval = (data.interval || interval) + 1;
        continue;
      }

      // expired_token, access_denied, etc.
      setError(data.error_description || data.error);
      setIsLoading(false);
      setUserCode(null);
      return null;
    }
    return null;
  };

  return { signIn, cancel, isLoading, error, userCode, isReady: true };
}
