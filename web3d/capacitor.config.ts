import type { CapacitorConfig } from "@capacitor/cli";

// Aplikasi Android membungkus build web yang sama (folder dist).
// appId adalah nama paket di Play Store: tidak bisa diganti setelah aplikasi pertama kali diunggah.
const config: CapacitorConfig = {
  appId: "com.chalidade.negeriwkwk",
  appName: "Negeri Wkwk",
  webDir: "dist",
  backgroundColor: "#fcb81c",
  android: {
    // tamu dan tuan rumah tersambung lewat WebRTC; konten campuran tidak dipakai
    allowMixedContent: false,
  },
};

export default config;
