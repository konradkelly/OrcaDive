import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { StatusBadge } from "./StatusBadge";

type PR = {
  id: string;
  title: string;
  repo: string;
  author: string;
  status: string;
  url: string;
  ageLabel: string;
};

type Props = {
  pr: PR;
};

export function PRItem({ pr }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => Linking.openURL(pr.url)}
    >
      <View style={styles.top}>
        <Text style={styles.repo}>{pr.repo}</Text>
        <StatusBadge status={pr.status} />
      </View>
      <Text style={styles.title}>{pr.title}</Text>
      <View style={styles.meta}>
        <Text style={styles.author}>by {pr.author}</Text>
        <Text style={styles.age}>{pr.ageLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  repo: { color: "#6366f1", fontSize: 12, fontWeight: "600" },
  title: { color: "#f8fafc", fontSize: 14, fontWeight: "500" },
  meta: { flexDirection: "row", justifyContent: "space-between" },
  author: { color: "#64748b", fontSize: 12 },
  age: { color: "#64748b", fontSize: 12 },
});
