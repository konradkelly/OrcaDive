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
  const { signIn, cancel, isLoading, error, userCode, isReady } = useGitHubAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.title}>OrcaDive</Text>
        <Text style={styles.subtitle}>
          See what your team is working on, powered by GitHub.
        </Text>

        {userCode ? (
          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>Enter this code on GitHub:</Text>
            <Text selectable style={styles.codeText}>{userCode}</Text>
            <Text style={styles.codeHint}>
              GitHub usually opens with this code already filled. Long-press to copy if you need it.
            </Text>
            <ActivityIndicator color="#6366f1" style={{ marginTop: 16 }} />
            <Text style={styles.waitingText}>Waiting for authorization...</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
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
        )}

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
  codeContainer: {
    alignItems: "center",
    gap: 8,
  },
  codeLabel: {
    color: "#94a3b8",
    fontSize: 14,
  },
  codeText: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    paddingVertical: 12,
  },
  codeHint: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },
  waitingText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cancelText: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    color: "#f87171",
    fontSize: 13,
    marginTop: 8,
  },
});
