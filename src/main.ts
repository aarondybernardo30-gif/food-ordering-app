
import { bootstrapApplication } from '@angular/platform-browser';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withPreloading,
  PreloadAllModules
} from '@angular/router';

import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

// Capacitor & Capgo OTA Updates
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Application files
import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

// Bootstrap Angular application
bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: RouteReuseStrategy,
      useClass: IonicRouteStrategy
    },

    provideIonicAngular(),

    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding()
    )
  ]
})
.then(async () => {
  console.log('Food Ordering App initialized successfully.');

  // Initialize Capgo OTA updates on Android/iOS only
  if (Capacitor.isNativePlatform()) {
    try {
      await CapacitorUpdater.notifyAppReady();

      console.log('Capgo OTA updater initialized successfully.');
    } catch (error) {
      console.error('Capgo OTA updater initialization failed:', error);
    }
  }
})
.catch((error) => {
  console.error('Failed to bootstrap Food Ordering App:', error);
});
