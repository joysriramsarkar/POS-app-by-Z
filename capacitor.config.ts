import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lakhan.pos',
  appName: 'Lakhan Bhandar',
  webDir: '.next/static',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000',
    cleartext: true
  }
};

export default config;
