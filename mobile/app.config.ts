import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "OrcaDive",
  slug: "orca-dive",
  version: "1.0.0",
  scheme: "orcadive",
  orientation: "portrait",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0f172a",
  },
  android: {
    package: "com.cascadecoffee.orcadive",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
  ],
  extra: {
    API_URL: process.env.API_URL ?? "http://localhost:3000",
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
    eas: {
      projectId: "your-eas-project-id",
    },
  },
});
