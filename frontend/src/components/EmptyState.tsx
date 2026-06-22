import React from 'react';
import { View, StyleSheet, Image, ViewStyle, StyleProp } from 'react-native';
import { Typography } from './Typography';
import { useApp } from '../contexts/AppContext';

interface EmptyStateProps {
  icon?: any;
  title: string;
  description: string;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, style }) => {
  const { colors } = useApp();

  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image source={icon} style={[styles.icon, { tintColor: colors.primary }]} resizeMode="contain" />
        </View>
      )}
      <Typography variant="h5" color={colors.black1} style={styles.title} align="center">
        {title}
      </Typography>
      <Typography variant="body1" color={colors.black2} style={styles.description} align="center">
        {description}
      </Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  icon: {
    width: 48,
    height: 48,
  },
  title: {
    marginBottom: 12,
  },
  description: {
    lineHeight: 24,
    paddingHorizontal: 20,
  },
});
