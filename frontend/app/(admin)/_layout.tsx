import React, { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const { user, initialized, colors } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (initialized && user?.role !== 'superadmin') {
      // Redirect non-admins back to home
      router.replace('/(tabs)/home');
    }
  }, [user, initialized]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user?.role !== 'superadmin') {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Admin Dashboard',
          headerShown: true,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }} 
      />
    </Stack>
  );
}
