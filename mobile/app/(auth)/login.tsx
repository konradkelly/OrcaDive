import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useGitHubAuth } from "../../hooks/useGitHubAuth";

export default function LoginScreen() {
  const { signIn, isLoading, error, isReady } = useGitHubAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>Team Radar</Text>
        <Text style={styles.subtitle}>
          See what your team is working on, powered by GitHub.
        </Text>

        <TouchableOpacity
          style={[styles.button, (!isReady || isLoading) && styles.buttonDisabled]}
          onPress={signIn}
          disabled={!isReady || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in with GitHub</Text>
          )}
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginTop: 8,
  },
});
