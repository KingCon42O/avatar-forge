import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kingcon42o.avatarforge",
  appName: "Avatar Forge",
  webDir: "app",
  android: { allowMixedContent: false, backgroundColor: "#08070c" },
  ios: { backgroundColor: "#08070c", contentInset: "automatic" }
};

export default config;
