import { useEffect } from "react";
import { Stack } from "expo-router";
import { useAuthStore } from "../store/authStore";

export default function RootLayout() {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
