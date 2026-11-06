import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'vn.quanlytaichinh',
  appName: 'Quan ly tai chinh',
  webDir: 'out',
  server: { url: 'https://quanlytaichinh.vercel.app', cleartext: true },
  android: { allowMixedContent: true },
  ios: { contentInset: 'always' },
};
export default config;
