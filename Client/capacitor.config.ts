import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: "com.antonio.ofertas",
  appName: "Fishing Store",
  npmClient: "npm",
  webDir: "www",
  server: {
    androidScheme: "http",
    cleartext: true,
  },
};

export default config;
