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
import { useAgentStore } from "../../store/agentStore";
import { useTeamSocket } from "../../hooks/useTeamSocket";
import { TeamMemberCard } from "../../components/TeamMemberCard";
import { AgentCard } from "../../components/AgentCard";

export default function DashboardScreen() {
  const { members, isLoading, fetchTeam } = useTeamStore();
  const { agents, fetchAgents } = useAgentStore();

  // Connect to WebSocket for real-time updates
  useTeamSocket();

  useEffect(() => {
    fetchTeam();
    fetchAgents();
  }, []);

  const activeAgents = agents.filter((a) => a.status !== "offline");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team Radar</Text>
        <Text style={styles.subtitle}>
          {members.filter((m) => m.updatedToday).length}/{members.length} updated today
          {activeAgents.length > 0 && ` · ${activeAgents.length} agent${activeAgents.length > 1 ? "s" : ""}`}
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
          ListFooterComponent={
            activeAgents.length > 0 ? (
              <View style={styles.agentSection}>
                <Text style={styles.sectionLabel}>Agents</Text>
                {activeAgents.map((a) => (
                  <AgentCard key={a.id} agent={a} compact />
                ))}
              </View>
            ) : null
          }
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
  agentSection: {
    marginTop: 16,
    gap: 8,
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
});
