import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackline.crimelife',
  appName: 'BLACKLINE',
  webDir: 'dist',
  backgroundColor: '#101212',
  android: { backgroundColor: '#101212', allowMixedContent: false },
  plugins: {
    SystemBars: { style: 'DARK', insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    SplashScreen: { launchShowDuration: 1000, backgroundColor: '#101212', showSpinner: false },
    CapacitorHttp: { enabled: false }
  }
};
export default config;
