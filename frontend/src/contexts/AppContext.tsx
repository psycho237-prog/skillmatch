import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../i18n/translations';
import { Colors, ThemeName, ColorScheme } from '../constants/Colors';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  notification_enabled: boolean;
  language: string;
  theme: string;
}

interface AppContextType {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;
  isLoggedIn: boolean;

  // Theme
  theme: ThemeName;
  themePreference: 'system' | 'light' | 'dark';
  setThemePreference: (pref: 'system' | 'light' | 'dark') => void;
  colors: ColorScheme;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;

  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@skillmatch_user',
  THEME: '@skillmatch_theme',
  LANGUAGE: '@skillmatch_language',
  NOTIFICATIONS: '@skillmatch_notifications',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [user, setUserState] = useState<User | null>(null);
  const [themePreference, setThemePrefState] = useState<'system' | 'light' | 'dark'>('system');
  const [language, setLangState] = useState<Language>('en');
  const [notificationsEnabled, setNotifState] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [storedUser, storedTheme, storedLang, storedNotif] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
      ]);

      if (storedUser) setUserState(JSON.parse(storedUser));
      if (storedTheme) setThemePrefState(storedTheme as 'system' | 'light' | 'dark');
      if (storedLang) setLangState(storedLang as Language);
      if (storedNotif !== null) setNotifState(storedNotif === 'true');

      setInitialized(true);
    } catch (e) {
      console.error('Failed to load settings:', e);
      setInitialized(true);
    }
  };

  const setUser = async (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
    }
  };

  const setThemePreference = async (pref: 'system' | 'light' | 'dark') => {
    setThemePrefState(pref);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, pref);
  };

  const setLanguage = async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotifState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(enabled));
  };

  // Resolve theme
  const theme: ThemeName =
    themePreference === 'system'
      ? (systemColorScheme === 'dark' ? 'dark' : 'light')
      : themePreference;

  const colors = Colors[theme];

  // Translation function
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[language]?.[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const isLoggedIn = !!user;

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isLoggedIn,
        theme,
        themePreference,
        setThemePreference,
        colors,
        language,
        setLanguage,
        t,
        notificationsEnabled,
        setNotificationsEnabled,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
