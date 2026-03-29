import { View, Text, StyleSheet } from "react-native";

type PRStatus = "open" | "review_requested" | "approved" | "draft";

const STATUS_COLOR: Record<PRStatus, string> = {
  open: "#22c55e",
  review_requested: "#f59e0b",
  approved: "#6366f1",
  draft: "#475569",
};

const STATUS_LABEL: Record<PRStatus, string> = {
  open: "Open",
  review_requested: "Needs Review",
  approved: "Approved",
  draft: "Draft",
};

type Props = {
  status: string;
};

export function StatusBadge({ status }: Props) {
  const color = STATUS_COLOR[status as PRStatus] ?? "#475569";
  const label = STATUS_LABEL[status as PRStatus] ?? status;

  return (
    <View style={[styles.pill, { backgroundColor: color + "22" }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: "600",
  },
});
