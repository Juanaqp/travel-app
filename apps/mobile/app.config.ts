import type { ConfigContext, ExpoConfig } from 'expo/config'

// Configuración dinámica de Expo — lee variables de entorno en build time
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TravelApp',
  slug: 'travelapp',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'travelapp',
  userInterfaceStyle: 'dark',
  splash: {
    resizeMode: 'contain',
    backgroundColor: '#0F172A',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.travelapp.mobile',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0F172A',
    },
    package: 'com.travelapp.mobile',
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0F172A',
      },
    ],
    'expo-sqlite',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#6366F1',
        sounds: [],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
})
