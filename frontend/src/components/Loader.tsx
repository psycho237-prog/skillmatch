import React from 'react';
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { useApp } from '../contexts/AppContext';

interface LoaderProps {
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function Loader({ fullScreen = false, style }: LoaderProps) {
  const { colors } = useApp();

  return (
    <View style={[styles.container, fullScreen && { flex: 1, backgroundColor: colors.background }, style]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
