import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { AppProvider, useApp } from '../src/contexts/AppContext';
import { View, ActivityIndicator, Image, StyleSheet, Dimensions } from 'react-native';
import { images } from '../src/constants';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/Colors';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { colors, theme, initialized } = useApp();

  if (!initialized) {
     return (
        <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
           <Image source={images.splashIcon} style={styles.splashIcon} resizeMode="contain" />
           <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
        </View>
     );
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

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashIcon: {
    width: 150,
    height: 150,
  }
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Rubik-Light': require('../assets/fonts/Rubik-Light.ttf'),
    'Rubik-Regular': require('../assets/fonts/Rubik-Regular.ttf'),
    'Rubik-Medium': require('../assets/fonts/Rubik-Medium.ttf'),
    'Rubik-SemiBold': require('../assets/fonts/Rubik-SemiBold.ttf'),
    'Rubik-Bold': require('../assets/fonts/Rubik-Bold.ttf'),
    'Rubik-ExtraBold': require('../assets/fonts/Rubik-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProvider>
      <RootLayoutNav />
    </AppProvider>
  );
}
