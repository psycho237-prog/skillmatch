import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { AppProvider, useApp } from '../src/contexts/AppContext';
import { setupNotificationHandlers } from '../src/services/notifications';
import { NotificationBanner } from '../src/components/NotificationBanner';
import { View, ActivityIndicator, Image, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { images } from '../src/constants';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutNav({ onLayoutReady }: { onLayoutReady: () => void }) {
  const { colors, theme, initialized } = useApp();
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (initialized) {
      onLayoutReady();
    }
  }, [initialized, onLayoutReady]);

  if (!initialized) {
     return null;
  }

  const isWebLargeScreen = Platform.OS === 'web' && width > 768;

  const content = (
    <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="service/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
      </Stack>
      <NotificationBanner />
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: isWebLargeScreen ? (theme === 'dark' ? '#0F0F1A' : '#F4F5F8') : colors.background }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {isWebLargeScreen ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{
            width: 420,
            height: 860,
            borderRadius: 36,
            backgroundColor: colors.background,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.2,
            shadowRadius: 32,
            elevation: 10,
            borderWidth: 8,
            borderColor: theme === 'dark' ? '#1E1E2E' : '#E2E8F0',
          }}>
            {content}
          </View>
        </View>
      ) : (
        content
      )}
    </View>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded] = useFonts({
    'Rubik-Light': require('../assets/fonts/Rubik-Light.ttf'),
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Medium': require('../assets/fonts/Rubik-Medium.ttf'),
    'Rubik-SemiBold': require('../assets/fonts/Rubik-SemiBold.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
    'Rubik-ExtraBold': require('../assets/fonts/Rubik-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded && appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, appReady]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProvider>
      <RootLayoutNav onLayoutReady={() => setAppReady(true)} />
    </AppProvider>
  );
}
