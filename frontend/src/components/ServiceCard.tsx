import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { Typography } from './Typography';
import { icons } from '../constants';

export interface ServiceCardProps {
  id: string;
  title: string;
  price: number;
  priceType: 'fixed' | 'hourly' | 'negotiable' | 'exchange';
  location: string;
  rating: number;
  imageUrl: string;
  isFeatured?: boolean;
  style?: ViewStyle;
  variant?: 'horizontal' | 'vertical';
}

export const ServiceCard = ({
  id,
  title,
  price,
  priceType,
  location,
  rating,
  imageUrl,
  isFeatured,
  style,
  variant = 'vertical',
}: ServiceCardProps) => {
  const { colors, t } = useApp();
  const router = useRouter();

  const handlePress = () => {
    router.push(`/service/${id}`);
  };

  const formatPrice = () => {
    if (priceType === 'exchange') return t('exchange');
    if (priceType === 'negotiable') return t('negotiable');
    const suffix = priceType === 'hourly' ? t('per_hour') : '';
    return `$${price}${suffix}`;
  };

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={[styles.hContainer, { backgroundColor: colors.card }, style]}
        activeOpacity={0.8}
        onPress={handlePress}
      >
        <Image source={{ uri: imageUrl }} style={styles.hImage} />
        <View style={styles.hContent}>
          <Typography variant="h6" numberOfLines={1}>{title}</Typography>
          <Typography variant="caption" color={colors.black2} style={styles.location}>
            {location}
          </Typography>
          <View style={styles.footer}>
            <Typography variant="h6" color={colors.primary}>
              {formatPrice()}
            </Typography>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Image source={icons.heart} style={[styles.heartIcon, { tintColor: colors.black3 }]} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.ratingBadge}>
          <Image source={icons.star} style={styles.starIcon} />
          <Typography variant="caption" weight="bold">{rating.toFixed(1)}</Typography>
        </View>
      </TouchableOpacity>
    );
  }

  // Vertical layout (Featured)
  return (
    <TouchableOpacity
      style={[styles.vContainer, style]}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      <Image source={{ uri: imageUrl }} style={styles.vImage} />
      {/* Overlay gradient would go here, simulating with view */}
      <View style={styles.vOverlay}>
        <View style={styles.vRatingBadge}>
          <Image source={icons.star} style={styles.starIcon} />
          <Typography variant="caption" weight="bold">{rating.toFixed(1)}</Typography>
        </View>
        
        <View style={styles.vBottomContent}>
          <Typography variant="h5" color="#FFF" numberOfLines={1}>{title}</Typography>
          <Typography variant="caption" color="#E0E0E0" style={styles.location}>
            {location}
          </Typography>
          <View style={styles.footer}>
            <Typography variant="h4" color="#FFF">
              {formatPrice()}
            </Typography>
            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Image source={icons.heart} style={[styles.heartIcon, { tintColor: '#FFF' }]} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Horizontal Styles
  hContainer: {
    width: '100%',
    borderRadius: 16,
    flexDirection: 'column',
    padding: 12,
    marginBottom: 16,
  },
  hImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
  },
  hContent: {
    marginTop: 12,
  },
  location: {
    marginTop: 4,
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  heartIcon: {
    width: 20,
    height: 20,
  },
  ratingBadge: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    width: 12,
    height: 12,
    tintColor: '#FFB800',
    marginRight: 4,
  },

  // Vertical Styles (Featured)
  vContainer: {
    width: 240,
    height: 300,
    borderRadius: 24,
    marginRight: 16,
    overflow: 'hidden',
  },
  vImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  vOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)', // Simulating gradient from bottom
    padding: 16,
    justifyContent: 'space-between',
  },
  vRatingBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vBottomContent: {
    width: '100%',
  },
});
