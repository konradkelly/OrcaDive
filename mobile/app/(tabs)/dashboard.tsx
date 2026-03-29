import { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useTeamStore } from "../../store/teamStore";
import { useTeamSocket } from "../../hooks/useTeamSocket";
import { TeamMemberCard } from "../../components/TeamMemberCard";

export default function DashboardScreen() {
  const { members, isLoading, fetchTeam } = useTeamStore();

  // Connect to WebSocket for real-time updates
  useTeamSocket();

  useEffect(() => {
    fetchTeam();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Radar</Text>
        <Text style={styles.subtitle}>
          {members.filter((m) => m.updatedToday).length}/{members.length} updated today
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <TeamMemberCard member={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  list: {
    padding: 16,
    gap: 12,
  },
});
