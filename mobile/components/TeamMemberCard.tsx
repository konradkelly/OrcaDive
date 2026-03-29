import { View, Text, StyleSheet } from "react-native";

type Member = {
  id: string;
  name: string;
  avatar: string;
  status: string;
  blockers: string | null;
  updatedToday: boolean;
  updatedAt: string;
  openPRs: number;
};

type Props = { member: Member };

function freshnessDot(updatedToday: boolean, updatedAt: string) {
  if (updatedToday) return { color: "#22c55e", label: "Updated today" };
  const hoursAgo =
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 48) return { color: "#f59e0b", label: "Yesterday" };
  return { color: "#475569", label: "Gone dark" };
}

export function TeamMemberCard({ member }: Props) {
  const freshness = freshnessDot(member.updatedToday, member.updatedAt);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <View style={[styles.dot, { backgroundColor: freshness.color }]} />
          <Text style={styles.name}>{member.name}</Text>
        </View>
        {member.openPRs > 0 && (
          <View style={styles.prBadge}>
            <Text style={styles.prBadgeText}>{member.openPRs} PR{member.openPRs > 1 ? "s" : ""}</Text>
          </View>
        )}
      </View>

      {/* Status text */}
      <Text style={styles.status}>
        {member.status || (
          <Text style={styles.noStatus}>No update yet</Text>
        )}
      </Text>

      {/* Blockers */}
      {member.blockers && (
        <View style={styles.blockerRow}>
          <Text style={styles.blockerLabel}>Blocked: </Text>
          <Text style={styles.blockerText}>{member.blockers}</Text>
        </View>
      )}

      {/* Footer */}
      <Text style={styles.timestamp}>{freshness.label}</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: "#f8fafc", fontSize: 15, fontWeight: "600" },
  prBadge: {
    backgroundColor: "#1e1b4b",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#3730a3",
  },
  prBadgeText: { color: "#a5b4fc", fontSize: 11, fontWeight: "600" },
  status: { color: "#cbd5e1", fontSize: 14, lineHeight: 20 },
  noStatus: { color: "#475569", fontStyle: "italic" },
  blockerRow: { flexDirection: "row", alignItems: "flex-start" },
  blockerLabel: { color: "#f87171", fontSize: 12, fontWeight: "600" },
  blockerText: { color: "#fca5a5", fontSize: 12, flex: 1 },
  timestamp: { color: "#475569", fontSize: 11, marginTop: 2 },
});
