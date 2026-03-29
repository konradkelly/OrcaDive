import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { usePRStore } from "../../store/prStore";
import { PRItem } from "../../components/PRItem";

export default function PRsScreen() {
  const { prs, isLoading, fetchPRs } = usePRStore();

  useEffect(() => {
    fetchPRs();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pull Requests</Text>
        <Text style={styles.subtitle}>{prs.length} open across all repos</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={prs}
          keyExtractor={(pr) => pr.id}
          renderItem={({ item }) => <PRItem pr={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
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
  list: { padding: 16, gap: 10 },
});
