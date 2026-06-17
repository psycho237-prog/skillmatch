import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../contexts/AppContext';
import { Typography } from './Typography';
import { icons } from '../constants';
import { resolveImageUrl } from '../services/api';

export interface ServiceCardProps {
  id: string;
  title: string;
  price: number;
  priceType: 'fixed' | 'hourly' | 'negotiable' | 'exchange';
  currency?: string;
  location: string;
  rating: number;
  imageUrl: string;
  isFeatured?: boolean;
  style?: ViewStyle;
  variant?: 'horizontal' | 'vertical';
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  holdupAmount?: number;
}

export const ServiceCard = ({
  id,
  title,
  price,
  priceType,
  currency = 'USD',
  location,
  rating,
  imageUrl,
  isFeatured,
  style,
  variant = 'vertical',
  isFavorited,
  onToggleFavorite,
  holdupAmount,
}: ServiceCardProps) => {
  const { colors, t } = useApp();
  const router = useRouter();

  const handlePress = () => {
    router.push(`/service/${id}`);
  };

  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = {
      'USD': '$', 'EUR': '€', 'XAF': 'FCFA', 'GBP': '£', 'CNY': '¥', 'RUB': '₽'
    };
    return symbols[code] || code;
  };

  const formatPrice = () => {
    const symbol = getCurrencySymbol(currency);
    if (priceType === 'exchange') {
      const hold = holdupAmount ? Number(holdupAmount).toLocaleString() : '0';
      return `Hold: ${hold} ${symbol}`;
    }
    if (priceType === 'negotiable') return t('negotiable');
    
    const suffix = priceType === 'hourly' ? t('per_hour') : '';
    
    if (currency === 'XAF') {
      return `${price}${suffix} ${symbol}`;
    }
    return `${symbol}${price}${suffix}`;
  };

  if (variant === 'horizontal') {
    return (
      <TouchableOpacity
        style={[styles.hContainer, { backgroundColor: colors.card }, style]}
        activeOpacity={0.8}
        onPress={handlePress}
      >
        <Image source={{ uri: resolveImageUrl(imageUrl) }} style={styles.hImage} />
        <View style={styles.hContent}>
          <Typography variant="h6" numberOfLines={1}>{title}</Typography>
          <Typography variant="caption" color={colors.black2} style={styles.location}>
            {location}
          </Typography>
          <View style={styles.footer}>
            <Typography variant="h6" color={colors.primary} numberOfLines={1} style={{ flex: 1 }}>
              {formatPrice()}
            </Typography>
            <TouchableOpacity 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFavorite?.();
              }}
            >
              <Image source={isFavorited ? icons.heartFilled : icons.heart} style={[styles.heartIcon, { tintColor: isFavorited ? colors.pink : colors.black3 }]} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.ratingBadge, { backgroundColor: colors.bg_rating }]}>
          <Image source={icons.star} style={styles.starIcon} />
          <Typography variant="caption" color={colors.rating_color} weight="bold">{Number(rating || 0).toFixed(1)}</Typography>
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
      <Image source={{ uri: resolveImageUrl(imageUrl) }} style={styles.vImage} />
      <View style={styles.vOverlay}>
        <View  style={[styles.vRatingBadge, { backgroundColor: colors.bg_rating }]}>
          <Image source={icons.star} style={styles.starIcon} />
          <Typography variant="caption" color={colors.rating_color} weight="bold">{Number(rating || 0).toFixed(1)}</Typography>
        </View>
        
        <View style={styles.vBottomContent}>
          <Typography variant="h5" color="#FFF" numberOfLines={1}>{title}</Typography>
          <Typography variant="caption" color="#E0E0E0" style={styles.location}>
            {location}
          </Typography>
          <View style={styles.footer}>
            <Typography variant="h4" color="#FFF" numberOfLines={1} style={{ flex: 1 }}>
              {formatPrice()}
            </Typography>
            <TouchableOpacity 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFavorite?.();
              }}
            >
              <Image source={isFavorited ? icons.heartFilled : icons.heart} style={[styles.heartIcon, { tintColor: isFavorited ? colors.pink : '#FFF' }]} />
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
    width: '48%',
    borderRadius: 16,
    flexDirection: 'column',
    padding: 10,
    marginRight: 1,
    marginBottom: 16,
  },
  hImage: {
    width: '100%',
    height: 120,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
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
    width: 210,
    height: 260,
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
    backgroundColor: 'rgba(0,0,0,0.3)', 
    padding: 16,
    justifyContent: 'space-between',
  },
  vRatingBadge: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vBottomContent: {
    width: '100%',
  },
});
