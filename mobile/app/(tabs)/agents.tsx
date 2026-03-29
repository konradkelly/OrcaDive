import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { useAgentStore } from "../../store/agentStore";
import { AgentCard } from "../../components/AgentCard";

type AgentRun = {
  id: string;
  task: string;
  status: string;
  output: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

const RUN_STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  running: "#6366f1",
  success: "#22c55e",
  failure: "#f87171",
  cancelled: "#475569",
};

export default function AgentsScreen() {
  const { agents, runs, isLoading, fetchAgents, fetchRuns, assignTask, cancelRun } =
    useAgentStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      fetchRuns(selectedAgentId);
    }
  }, [selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const agentRuns = selectedAgentId ? runs[selectedAgentId] ?? [] : [];

  const handleAssignTask = async () => {
    if (!taskInput.trim() || !selectedAgentId) return;
    try {
      await assignTask(selectedAgentId, taskInput.trim());
      setTaskInput("");
    } catch {
      Alert.alert("Error", "Failed to assign task.");
    }
  };

  const handleCancel = (runId: string) => {
    if (!selectedAgentId) return;
    Alert.alert("Cancel run", "Are you sure?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: () => cancelRun(selectedAgentId, runId),
      },
    ]);
  };

  // Agent detail view
  if (selectedAgent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedAgentId(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedAgent.name}</Text>
        </View>

        {/* Task assignment */}
        <View style={styles.assignRow}>
          <TextInput
            style={styles.taskInput}
            placeholder="Assign a task..."
            placeholderTextColor="#475569"
            value={taskInput}
            onChangeText={setTaskInput}
          />
          <TouchableOpacity
            style={[styles.assignButton, !taskInput.trim() && styles.assignButtonDisabled]}
            onPress={handleAssignTask}
            disabled={!taskInput.trim()}
          >
            <Text style={styles.assignButtonText}>Assign</Text>
          </TouchableOpacity>
        </View>

        {/* Run history */}
        <FlatList
          data={agentRuns}
          keyExtractor={(r) => r.id}
          renderItem={({ item }: { item: AgentRun }) => (
            <View style={styles.runCard}>
              <View style={styles.runHeader}>
                <Text style={styles.runTask}>{item.task}</Text>
                <View
                  style={[
                    styles.runPill,
                    { backgroundColor: (RUN_STATUS_COLOR[item.status] ?? "#475569") + "22" },
                  ]}
                >
                  <Text
                    style={[
                      styles.runPillText,
                      { color: RUN_STATUS_COLOR[item.status] ?? "#475569" },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              {item.output && <Text style={styles.runOutput}>{item.output}</Text>}
              {(item.status === "pending" || item.status === "running") && (
                <TouchableOpacity onPress={() => handleCancel(item.id)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No runs yet. Assign a task above.</Text>
          }
        />
      </SafeAreaView>
    );
  }

  // Agent list view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.subtitle}>
          {agents.filter((a) => a.status === "running").length} running
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={agents}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedAgentId(item.id)}>
              <AgentCard agent={item} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No agents registered yet. Add one from Settings.
            </Text>
          }
        />
      )}
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
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  backButton: { color: "#6366f1", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  list: { padding: 16, gap: 10 },
  assignRow: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
  },
  taskInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  assignButton: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  assignButtonDisabled: { opacity: 0.5 },
  assignButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  runCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  runHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  runTask: { color: "#f8fafc", fontSize: 14, fontWeight: "500", flex: 1, marginRight: 8 },
  runPill: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  runPillText: { fontSize: 11, fontWeight: "600" },
  runOutput: { color: "#94a3b8", fontSize: 12, lineHeight: 18 },
  cancelText: { color: "#f87171", fontSize: 12, fontWeight: "600", marginTop: 4 },
  emptyText: { color: "#475569", fontSize: 14, textAlign: "center", marginTop: 40 },
});
