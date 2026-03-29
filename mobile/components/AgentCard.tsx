import { View, Text, StyleSheet } from "react-native";

type Agent = {
  id: string;
  name: string;
  type: "custom" | "copilot" | "ci";
  avatar_url: string | null;
  status: "idle" | "running" | "error" | "offline";
  last_seen: string | null;
};

type Props = { agent: Agent; compact?: boolean };

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  idle: { color: "#22c55e", label: "Idle" },
  running: { color: "#6366f1", label: "Running" },
  error: { color: "#f87171", label: "Error" },
  offline: { color: "#475569", label: "Offline" },
};

const TYPE_LABEL: Record<string, string> = {
  custom: "Custom Agent",
  copilot: "Copilot",
  ci: "CI Bot",
};

function lastSeenLabel(lastSeen: string | null): string {
  if (!lastSeen) return "Never seen";
  const hours = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return "Active now";
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AgentCard({ agent, compact }: Props) {
  const statusInfo = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: statusInfo.color }]} />
          <Text style={styles.name}>{agent.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeText}>{TYPE_LABEL[agent.type] ?? agent.type}</Text>
          </View>
        </View>
        <Text style={styles.timestamp}>{statusInfo.label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: statusInfo.color }]} />
          <Text style={styles.name}>{agent.name}</Text>
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{TYPE_LABEL[agent.type] ?? agent.type}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusPill, { backgroundColor: statusInfo.color + "22" }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      <Text style={styles.timestamp}>{lastSeenLabel(agent.last_seen)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  compactCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  typeBadge: {
    backgroundColor: "#1e1b4b",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#3730a3",
  },
  typeText: { color: "#a5b4fc", fontSize: 10, fontWeight: "600" },
  statusRow: { flexDirection: "row" },
  statusPill: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  timestamp: { color: "#475569", fontSize: 11, marginTop: 2 },
});
