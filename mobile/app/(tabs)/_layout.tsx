import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Radar" }}
      />
      <Tabs.Screen
        name="status"
        options={{ title: "My Status" }}
      />
      <Tabs.Screen
        name="prs"
        options={{ title: "PRs" }}
      />
      <Tabs.Screen
        name="agents"
        options={{ title: "Agents" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#0f172a",
    borderTopColor: "#1e293b",
    paddingBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
