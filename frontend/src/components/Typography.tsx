import React, { forwardRef } from 'react';
import {
  Text,
  TextStyle,
  TextProps as RNTextProps,
  StyleSheet,
} from 'react-native';
import { useApp } from '../contexts/AppContext';

export interface TypographyProps extends RNTextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'button';
  color?: string;
  weight?: 'regular' | 'medium' | 'semiBold' | 'bold' | 'extraBold' | 'light';
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const Typography = forwardRef<Text, TypographyProps>(
  ({ style, variant = 'body1', color, weight, align, children, ...rest }, ref) => {
    const { colors } = useApp();

    const getFontFamily = () => {
      switch (weight) {
        case 'light': return 'Rubik-Light';
        case 'regular': return 'Rubik-Regular';
        case 'medium': return 'Rubik-Medium';
        case 'semiBold': return 'Rubik-SemiBold';
        case 'bold': return 'Rubik-Bold';
        case 'extraBold': return 'Rubik-ExtraBold';
        default: return 'Rubik-Regular';
      }
    };

    const getVariantStyle = (): TextStyle => {
      switch (variant) {
        case 'h1': return { fontSize: 32, lineHeight: 40, fontFamily: 'Rubik-Bold' };
        case 'h2': return { fontSize: 24, lineHeight: 32, fontFamily: 'Rubik-Bold' };
        case 'h3': return { fontSize: 20, lineHeight: 28, fontFamily: 'Rubik-Bold' };
        case 'h4': return { fontSize: 18, lineHeight: 24, fontFamily: 'Rubik-SemiBold' };
        case 'h5': return { fontSize: 16, lineHeight: 24, fontFamily: 'Rubik-SemiBold' };
        case 'h6': return { fontSize: 14, lineHeight: 20, fontFamily: 'Rubik-SemiBold' };
        case 'body1': return { fontSize: 16, lineHeight: 24, fontFamily: 'Rubik-Regular' };
        case 'body2': return { fontSize: 14, lineHeight: 20, fontFamily: 'Rubik-Regular' };
        case 'caption': return { fontSize: 12, lineHeight: 16, fontFamily: 'Rubik-Regular' };
        case 'button': return { fontSize: 16, lineHeight: 24, fontFamily: 'Rubik-Medium' };
      }
    };

    const combinedStyle: TextStyle = {
      ...getVariantStyle(),
      color: color || colors.black1,
      textAlign: align || 'auto',
      ...(weight && { fontFamily: getFontFamily() }),
    };

    return (
      <Text
        ref={ref}
        style={[combinedStyle, style]}
        {...rest}
      >
        {children}
      </Text>
    );
  }
);

Typography.displayName = 'Typography';
