
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.foodordering.foodordering',
  appName: 'app',
  webDir: 'www/browser',

  plugins: {
    SystemBars: {
      insetsHandling: 'disable'
    },

    CapacitorUpdater: {
      appId: 'com.foodordering.foodordering',

      // Automatically download updates and apply
      // them when the app goes to the background.
      autoUpdate: 'atBackground',

      // Default OTA release channel.
      defaultChannel: 'production',

      // Return to the previous working bundle
      // if the new update fails.
      resetWhenUpdate: true,

      // Remove previous bundles to save storage.
      autoDeletePrevious: true,

      // Remove failed update bundles.
      autoDeleteFailed: true
    }
  }
};

export default config;
