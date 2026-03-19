import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lakhan.pos',
  appName: 'Lakhan POS',
  webDir: 'public',
  server: {
    url: 'https://lakhanb.vercel.app',
    cleartext: false
  }
};

export default config;
