import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useStatusSuggestion } from "../../hooks/useStatusSuggestion";
import { useTeamStore } from "../../store/teamStore";
import { useAuthStore } from "../../store/authStore";
import { api } from "../../lib/api";

export default function StatusScreen() {
  const [statusText, setStatusText] = useState("");
  const [blockers, setBlockers] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const { suggestion, isLoadingSuggestion, fetchSuggestion } = useStatusSuggestion();
  const { myLastStatus, updateMemberStatus } = useTeamStore();
  const { userId } = useAuthStore();

  // Pre-fill with AI suggestion when it arrives
  useEffect(() => {
    if (suggestion && !statusText) {
      setStatusText(suggestion);
    }
  }, [suggestion]);

  // Fetch suggestion on mount
  useEffect(() => {
    fetchSuggestion();
  }, []);

  const handlePost = async () => {
    if (!statusText.trim()) return;
    setIsPosting(true);
    try {
      const trimmedText = statusText.trim();
      const trimmedBlockers = blockers.trim() || null;
      await api.post("/status", {
        text: trimmedText,
        blockers: trimmedBlockers,
      });
      if (userId) {
        updateMemberStatus({ memberId: userId, status: trimmedText, blockers: trimmedBlockers });
      }
      setStatusText("");
      setBlockers("");
      Alert.alert("Posted!", "Your team can see your update.");
    } catch {
      Alert.alert("Error", "Failed to post status. Try again.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Status</Text>
      </View>

      <View style={styles.body}>
        {/* AI Suggestion Badge */}
        {isLoadingSuggestion ? (
          <View style={styles.suggestionBadge}>
            <ActivityIndicator size="small" color="#6366f1" />
            <Text style={styles.suggestionLabel}>
              Checking your GitHub activity...
            </Text>
          </View>
        ) : suggestion ? (
          <View style={styles.suggestionBadge}>
            <Text style={styles.aiLabel}>✦ AI suggestion from GitHub activity</Text>
          </View>
        ) : null}

        {/* Status Input */}
        <Text style={styles.label}>What are you working on?</Text>
        <TextInput
          style={styles.textArea}
          value={statusText}
          onChangeText={setStatusText}
          placeholder="Working on..."
          placeholderTextColor="#475569"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Blockers Input */}
        <Text style={styles.label}>Blockers? (optional)</Text>
        <TextInput
          style={[styles.textArea, styles.blockersInput]}
          value={blockers}
          onChangeText={setBlockers}
          placeholder="Nothing blocking me"
          placeholderTextColor="#475569"
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />

        {/* Last Status */}
        {myLastStatus && (
          <Text style={styles.lastStatus}>
            Last update: {myLastStatus}
          </Text>
        )}

        {/* Post Button */}
        <TouchableOpacity
          style={[styles.postButton, !statusText.trim() && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={!statusText.trim() || isPosting}
        >
          {isPosting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.postButtonText}>Post to Team</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: { fontSize: 24, fontWeight: "700", color: "#f8fafc" },
  body: { padding: 20, gap: 12 },
  suggestionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1e1b4b",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#3730a3",
  },
  suggestionLabel: { color: "#a5b4fc", fontSize: 13 },
  aiLabel: { color: "#a5b4fc", fontSize: 13 },
  label: { color: "#94a3b8", fontSize: 13, fontWeight: "500", marginTop: 4 },
  textArea: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    color: "#f8fafc",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 100,
  },
  blockersInput: { minHeight: 60 },
  lastStatus: { color: "#475569", fontSize: 12, fontStyle: "italic" },
  postButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  postButtonDisabled: { opacity: 0.4 },
  postButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
