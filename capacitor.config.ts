import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.updraft.game',
  appName: 'Updraft',
  webDir: 'dist',
  backgroundColor: '#87CEEB',
  ios: {
    backgroundColor: '#87CEEB',
    contentInset: 'always',
    preferredContentMode: 'mobile',
    scheme: 'Updraft',
  },
  android: {
    backgroundColor: '#87CEEB',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#87CEEB',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#87CEEB',
    },
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
