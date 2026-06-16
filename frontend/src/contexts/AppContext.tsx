import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../i18n/translations';
import { Colors, ThemeName, ColorScheme } from '../constants/Colors';
import { registerForPushNotificationsAsync, setupNotificationHandlers } from '../services/notifications';
import { api } from '../services/api';

interface User {
  id: string;
  phone_number: string;
  display_name: string;
  avatar_url: string | null;
  notification_enabled: boolean;
  language: string;
  theme: string;
}

interface AppContextType {
  // Auth
  user: User | null;
  setUser: (user: User | null, token?: string | null) => void;
  isLoggedIn: boolean;
  token: string | null;

  // Theme
  theme: ThemeName;
  themePreference: 'system' | 'light' | 'dark';
  setThemePreference: (pref: 'system' | 'light' | 'dark') => void;
  setTheme: (pref: 'system' | 'light' | 'dark') => void; // Alias
  colors: ColorScheme;

  // Language
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;

  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;

  initialized: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@skillmatch_user',
  TOKEN: '@skillmatch_token',
  THEME: '@skillmatch_theme',
  LANGUAGE: '@skillmatch_language',
  NOTIFICATIONS: '@skillmatch_notifications',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [themePreference, setThemePrefState] = useState<'system' | 'light' | 'dark'>('light');
  const [language, setLangState] = useState<Language>('en');
  const [notificationsEnabled, setNotifState] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (initialized && user && notificationsEnabled) {
      registerForPushNotificationsAsync(user.id);
      return setupNotificationHandlers();
    }
  }, [user, initialized, notificationsEnabled]);

  const loadSettings = async () => {
    try {
      const [storedUser, storedToken, storedTheme, storedLang, storedNotif] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
      ]);

      if (storedUser) setUserState(JSON.parse(storedUser));
      if (storedToken) setTokenState(storedToken);
      if (storedTheme) setThemePrefState(storedTheme as 'system' | 'light' | 'dark');
      if (storedLang) setLangState(storedLang as Language);
      if (storedNotif !== null) setNotifState(storedNotif === 'true');

      setInitialized(true);
    } catch (e) {
      console.error('Failed to load settings:', e);
      setInitialized(true);
    }
  };

  const setUser = async (newUser: User | null, newToken?: string | null) => {
    setUserState(newUser);
    if (newToken !== undefined) setTokenState(newToken);

    if (newUser) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
      if (newToken) await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
      if (newUser.theme) {
        setThemePrefState(newUser.theme as 'system' | 'light' | 'dark');
        await AsyncStorage.setItem(STORAGE_KEYS.THEME, newUser.theme);
      }
      if (newUser.language) {
        setLangState(newUser.language as Language);
        await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, newUser.language);
      }
      if (newUser.notification_enabled !== undefined) {
        setNotifState(newUser.notification_enabled);
        await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(newUser.notification_enabled));
      }
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
      setThemePrefState('light');
      await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
    }
  };

  const setThemePreference = async (pref: 'system' | 'light' | 'dark') => {
    setThemePrefState(pref);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, pref);
    if (user) {
      try {
        const updateRes = await api.updateUser(user.id, { theme: pref });
        setUserState(updateRes.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updateRes.user));
      } catch (e) {
        console.error('Failed to sync theme to server:', e);
      }
    }
  };

  const setLanguage = async (lang: Language) => {
    setLangState(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    if (user) {
      try {
        const updateRes = await api.updateUser(user.id, { language: lang });
        setUserState(updateRes.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updateRes.user));
      } catch (e) {
        console.error('Failed to sync language to server:', e);
      }
    }
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotifState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(enabled));
    if (user) {
      try {
        const updateRes = await api.updateUser(user.id, { notification_enabled: enabled });
        setUserState(updateRes.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updateRes.user));
      } catch (e) {
        console.error('Failed to sync notifications to server:', e);
      }
    }
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

  const isLoggedIn = !!user && !!token;

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isLoggedIn,
        token,
        theme,
        themePreference,
        setThemePreference,
        setTheme: setThemePreference, // Alias
        colors,
        language,
        setLanguage,
        t,
        notificationsEnabled,
        setNotificationsEnabled,
        initialized,
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
