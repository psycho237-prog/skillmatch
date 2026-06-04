import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  Image,
  ImageSourcePropType,
  View,
} from 'react-native';
import { useApp } from '../contexts/AppContext';
import { Typography } from './Typography';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  leftIcon?: ImageSourcePropType;
  rightIcon?: ImageSourcePropType;
  fullWidth?: boolean;
}

export const Button = ({
  title,
  variant = 'primary',
  size = 'medium',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  disabled,
  ...rest
}: ButtonProps) => {
  const { colors } = useApp();

  const getContainerStyle = (): ViewStyle => {
    let base: ViewStyle = {};
    
    switch (size) {
      case 'small': base = { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 }; break;
      case 'medium': base = { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 30 }; break;
      case 'large': base = { paddingVertical: 18, paddingHorizontal: 32, borderRadius: 30 }; break;
    }

    if (fullWidth) {
      base.width = '100%';
    }

    switch (variant) {
      case 'primary':
        return { ...base, backgroundColor: colors.primary };
      case 'secondary':
        return { ...base, backgroundColor: colors.primaryUltraLight };
      case 'outline':
        return { ...base, backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border };
      case 'ghost':
        return { ...base, backgroundColor: 'transparent' };
      case 'danger':
        return { ...base, backgroundColor: colors.danger };
    }
  };

  const getTextColor = (): string => {
    if (disabled) return colors.black3;
    switch (variant) {
      case 'primary': return Colors.light.white; // Always white on primary
      case 'secondary': return colors.primary;
      case 'outline': return colors.black1;
      case 'ghost': return colors.primary;
      case 'danger': return Colors.light.white;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        getContainerStyle(),
        disabled && { opacity: 0.5 },
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <View style={styles.content}>
          {leftIcon && (
            <Image
              source={leftIcon}
              style={[styles.icon, { tintColor: variant === 'primary' ? undefined : undefined }, { marginRight: 8 }]}
              resizeMode="contain"
            />
          )}
          <Typography
            variant="button"
            color={getTextColor()}
            align="center"
          >
            {title}
          </Typography>
          {rightIcon && (
            <Image
              source={rightIcon}
              style={[styles.icon, { tintColor: getTextColor() }, { marginLeft: 8 }]}
              resizeMode="contain"
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 20,
    height: 20,
  },
});

import { Colors } from '../constants/Colors';
