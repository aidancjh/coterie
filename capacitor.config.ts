import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coterie.app',
  appName: 'Coterie',
  // The app ships the built frontend from `dist` inside the bundle, rather than
  // pointing at the live site — Apple rejects apps that are only a remote URL.
  //
  // Because the bundle is served from capacitor://localhost, a relative `/api`
  // call resolves to the bundle and nothing answers it. Two things make it work:
  //   1. build with VITE_API_ORIGIN set, so src/lib/api.ts issues absolute calls
  //      (see the `build:ios` script in package.json);
  //   2. server/index.js allows the capacitor:// origin through CORS.
  webDir: 'dist',
};

export default config;
