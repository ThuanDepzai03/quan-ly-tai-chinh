import type { CapacitorConfig } from '@capacitor/cli';

// App mobile đóng gói từ web đã deploy trên Vercel.
// - Android: npx cap add android && npx cap sync && npx cap open android
// - iOS (cần máy Mac + Xcode): npx cap add ios && npx cap sync && npx cap open ios
// Chỉ dùng cá nhân trên iPhone: mở web trên Safari > Chia sẻ > Thêm vào Màn hình chính.
const config: CapacitorConfig = {
  appId: 'vn.quanlytaichinh',
  appName: 'Quản lý tài chính',
  webDir: 'out',
  server: {
    url: 'https://quanlytaichinh.vercel.app',
    cleartext: true,
  },
  android: { allowMixedContent: true },
  ios: { contentInset: 'always' },
};
export default config;
