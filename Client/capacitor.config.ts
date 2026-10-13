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
  plugins: {  
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0759d9",
      showSpinner: false,
    },
  },
};

export default config;
