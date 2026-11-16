import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'app',
  webDir: 'www/browser',
  plugins: {
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;