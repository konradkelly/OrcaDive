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
  Modal,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useAgentStore } from "../../store/agentStore";
import { useTeamStore } from "../../store/teamStore";
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

const AGENT_TYPES = ["custom", "copilot", "ci"] as const;

export default function AgentsScreen() {
  const {
    agents,
    runs,
    isLoading,
    fetchAgents,
    createAgent,
    fetchRuns,
    assignTask,
    cancelRun,
  } = useAgentStore();
  const fetchTeam = useTeamStore((s) => s.fetchTeam);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [taskInput, setTaskInput] = useState("");

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerType, setRegisterType] =
    useState<(typeof AGENT_TYPES)[number]>("custom");
  const [registerSubmitting, setRegisterSubmitting] = useState(false);

  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");

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

  const handleRegisterAgent = async () => {
    const name = registerName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter a name for the agent.");
      return;
    }
    setRegisterSubmitting(true);
    try {
      const apiKey = await createAgent(name, registerType);
      setRegisterOpen(false);
      setRegisterName("");
      setRegisterType("custom");
      setNewApiKey(apiKey);
      setKeyModalOpen(true);
      await fetchTeam();
    } catch {
      Alert.alert("Error", "Could not register agent.");
    } finally {
      setRegisterSubmitting(false);
    }
  };

  const copyKey = async () => {
    await Clipboard.setStringAsync(newApiKey);
    Alert.alert("Copied", "API key copied to clipboard.");
  };

  if (selectedAgent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedAgentId(null)}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedAgent.name}</Text>
        </View>

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agents</Text>
        <Text style={styles.subtitle}>
          {agents.filter((a) => a.status === "running").length} running
        </Text>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => setRegisterOpen(true)}
        >
          <Text style={styles.registerBtnText}>Register agent</Text>
        </TouchableOpacity>
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
              No agents yet. Tap Register agent to add one and get an API key.
            </Text>
          }
        />
      )}

      <Modal
        visible={registerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRegisterOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Register agent</Text>
            <Text style={styles.modalHint}>
              You will receive an API key once. Store it for your agent process.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Agent name"
              placeholderTextColor="#64748b"
              value={registerName}
              onChangeText={setRegisterName}
            />
            <Text style={styles.typeLabel}>Type</Text>
            <View style={styles.typeRow}>
              {AGENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeChip,
                    registerType === t && styles.typeChipActive,
                  ]}
                  onPress={() => setRegisterType(t)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      registerType === t && styles.typeChipTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setRegisterOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalOk,
                  registerSubmitting && styles.assignButtonDisabled,
                ]}
                onPress={handleRegisterAgent}
                disabled={registerSubmitting}
              >
                <Text style={styles.modalOkText}>
                  {registerSubmitting ? "…" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={keyModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setKeyModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save your API key</Text>
            <Text style={styles.modalHint}>
              This key is shown only once. Use it as{" "}
              <Text style={styles.monoHint}>Authorization: Bearer {"<key>"}</Text>
            </Text>
            <ScrollView style={styles.keyScroll}>
              <Text selectable style={styles.keyText}>
                {newApiKey}
              </Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={copyKey}>
                <Text style={styles.modalCancelText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOk}
                onPress={() => setKeyModalOpen(false)}
              >
                <Text style={styles.modalOkText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 8,
  },
  title: { fontSize: 24, fontWeight: "700", color: "#f8fafc" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  registerBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#312e81",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4338ca",
    marginTop: 4,
  },
  registerBtnText: { color: "#a5b4fc", fontWeight: "700", fontSize: 14 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    maxHeight: "90%",
  },
  modalTitle: { color: "#f8fafc", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalHint: { color: "#94a3b8", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  monoHint: { color: "#cbd5e1", fontFamily: "monospace" },
  modalInput: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 12,
    color: "#f8fafc",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 12,
  },
  typeLabel: { color: "#64748b", fontSize: 12, fontWeight: "600", marginBottom: 8 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  typeChipActive: {
    borderColor: "#6366f1",
    backgroundColor: "#1e1b4b",
  },
  typeChipText: { color: "#94a3b8", fontSize: 13, fontWeight: "600" },
  typeChipTextActive: { color: "#a5b4fc" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { color: "#94a3b8", fontWeight: "600" },
  modalOk: {
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalOkText: { color: "#fff", fontWeight: "700" },
  keyScroll: { maxHeight: 120, marginBottom: 12 },
  keyText: {
    color: "#e2e8f0",
    fontSize: 12,
    fontFamily: "monospace",
  },
});
