import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { AppProvider, useApp } from '../../contexts/AppContext';
import { View, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { images } from '../../constants';
import Animated, { FadeIn } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => { });

function RootLayoutNav({ onLayoutReady }: { onLayoutReady: () => void }) {
  const { colors, theme, initialized } = useApp();

  useEffect(() => {
    if (initialized) {
      onLayoutReady();
    }
  }, [initialized, onLayoutReady]);

  if (!initialized) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="service/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
        </Stack>
      </Animated.View>
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
      SplashScreen.hideAsync().catch(() => { });
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
