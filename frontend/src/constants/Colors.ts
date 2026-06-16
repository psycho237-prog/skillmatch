// SkillMatch Design Tokens — follows design.pdf exactly
export const Colors = {
  light: {
    primary: '#3B82F6', // Lighter blue
    primaryLight: 'rgba(59, 130, 246, 0.10)',
    primaryUltraLight: 'rgba(59, 130, 246, 0.04)',
    black1: '#191D31',
    black2: '#666876',
    black3: '#8C8E98',
    bg_description: '#f4f4f5ff',
    icon_bg: '#7f80889f',
    white: '#FFFFFF',
    background: '#FFFFFF',
    card: '#F7F7F7',
    border: '#E8E8E8',
    danger: '#F75555',
    pink: '#FF4B91',
    success: '#4CAF50',
    warning: '#FF9800',
    star: '#FFB800',
    inputBg: '#F5F5F5',
    shadow: 'rgba(0, 0, 0, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E8E8E8',
    bg_rating:'#b4b3b3ec',
    rating_color:'#000000ff',
  },
  dark: {
     bg_rating:'#2C2C2E',
     icon_bg: 'rgba(255,255,255,0.2)',
    rating_color:'#ffffffff',
    primary: '#3B82F6', // Lighter blue
    primaryLight: 'rgba(59, 130, 246, 0.20)',
    primaryUltraLight: 'rgba(59, 130, 246, 0.08)',
    black1: '#FFFFFF', // Text is light (white) in dark mode
    black2: '#E5E5EA', // Lighter secondary text
    black3: '#AEAEB2', // Lighter tertiary text
    bg_description: '#2C2C2E',
    white: '#1C1C1E',
    background: '#121212', // Gris / Dark grey background
    card: '#1C1C1E',       // Slightly lighter grey for cards
    border: '#2C2C2E',     // Divider grey
    danger: '#FF453A',     // iOS dark mode red
    pink: '#FF375F',
    success: '#32D74B',
    warning: '#FF9F0A',
    star: '#FFD60A',
    inputBg: '#2C2C2E',
    shadow: 'rgba(0, 0, 0, 0.3)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    tabBar: '#1C1C1E',
    tabBarBorder: '#2C2C2E',
  },
};

export type ThemeName = 'light' | 'dark';
export type ColorScheme = typeof Colors.light;
