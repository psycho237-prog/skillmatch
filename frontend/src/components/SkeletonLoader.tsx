import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, DimensionValue } from 'react-native';
import { useApp } from '../contexts/AppContext';

interface SkeletonLoaderProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8, 
  style 
}) => {
  const { colors, theme } = useApp();
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacityAnim]);

  const baseColor = theme === 'dark' ? '#2A2A3C' : '#E2E8F0';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

export const ServiceCardSkeleton = ({ variant = 'vertical' }: { variant?: 'vertical' | 'horizontal' | 'grid' }) => {
  const { colors } = useApp();
  
  const isGrid = variant === 'grid';
  const isHorizontal = variant === 'horizontal';
  const width = isGrid ? '48%' : (variant === 'vertical' ? 280 : '100%');
  
  if (isHorizontal) {
    return (
      <View style={[styles.cardContainer, { width, backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16, flexDirection: 'row', height: 120 }]}>
        <SkeletonLoader width={120} height="100%" borderRadius={0} />
        <View style={[styles.cardContent, { flex: 1, justifyContent: 'center' }]}>
          <SkeletonLoader height={20} width="80%" style={{ marginBottom: 8 }} />
          <SkeletonLoader height={14} width="50%" style={{ marginBottom: 12 }} />
          <View style={styles.cardFooter}>
            <SkeletonLoader height={18} width="40%" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.cardContainer, { width, backgroundColor: colors.card, borderColor: colors.border, marginBottom: isGrid ? 16 : 8, marginRight: isGrid ? 0 : 16 }]}>
      <SkeletonLoader height={140} borderRadius={16} />
      <View style={styles.cardContent}>
        <SkeletonLoader height={24} width="80%" style={{ marginBottom: 8 }} />
        <SkeletonLoader height={16} width="60%" style={{ marginBottom: 12 }} />
        <View style={styles.cardFooter}>
          <SkeletonLoader height={20} width="40%" />
          <SkeletonLoader height={20} width={40} borderRadius={20} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
});
