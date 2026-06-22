import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from '../i18n/translations';
import { Colors, ThemeName, ColorScheme } from '../constants/Colors';
import { registerForPushNotificationsAsync, setupNotificationHandlers } from '../services/notifications';
import { api } from '../services/api';
import { socketService } from '../services/socket';

interface User {
  id: string;
  phone_number: string;
  display_name: string;
  avatar_url: string | null;
  notification_enabled: boolean;
  language: string;
  theme: string;
  role?: string;
  currency?: string | null;
  subscription_tier?: string;
  subscription_expires_at?: string | null;
  auto_renew_pro?: boolean;
  chat_backup_enabled?: boolean;
}

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
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
  notifications: StoredNotification[];
  clearNotifications: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  addNotification: (title: string, body: string) => Promise<void>;

  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (val: boolean) => Promise<void>;

  initialized: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: '@skillmatch_user',
  TOKEN: '@skillmatch_token',
  THEME: '@skillmatch_theme',
  LANGUAGE: '@skillmatch_language',
  NOTIFICATIONS: '@skillmatch_notifications',
  ONBOARDING: '@skillmatch_onboarding',
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [systemColorScheme, setSystemColorScheme] = useState(Appearance.getColorScheme());
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [themePreference, setThemePrefState] = useState<'system' | 'light' | 'dark'>('system');

  // Monitor system color scheme changes dynamically
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });
    return () => {
      subscription.remove();
    };
  }, []);
  const [language, setLangState] = useState<Language>('en');
  const [notificationsEnabled, setNotifState] = useState(true);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [hasSeenOnboarding, setHasSeenOnboardingState] = useState(false);
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

  // Global Socket Listener & Connection Management
  useEffect(() => {
    if (user) {
      socketService.connect(user.id);

      const handleSocketNotification = (data: any) => {
        console.log('[SOCKET NOTIFICATION RECEIVED]', data);
        let title = 'Notification';
        let body = '';
        if (data.title && data.body) {
          title = data.title;
          body = data.body;
        } else if (data.event) {
          const event = data.event;
          if (event === 'BOTH_LOCKED') {
            title = 'Escrow Locked 🔒';
            body = 'Funds have been locked in escrow. Work can begin!';
          } else if (event === 'PROVIDER_MARKED_DONE') {
            title = 'Service Delivered 📦';
            body = 'The provider has marked the service as delivered. Please review and confirm.';
          } else if (event === 'COMPLETED') {
            title = 'Transaction Complete ✅';
            body = 'Receipt confirmed. Funds have been released.';
          } else if (event === 'DISPUTED') {
            title = 'Dispute Opened ⚠️';
            body = 'A dispute has been opened for this transaction.';
          } else if (event === 'CANCELLED') {
            title = 'Transaction Cancelled ❌';
            body = 'The transaction has been cancelled.';
          } else {
            title = event.replace(/_/g, ' ');
            body = 'Escrow status updated.';
          }
        }
        addNotification(title, body);
      };

      socketService.on(`user_notification_${user.id}`, handleSocketNotification);

      return () => {
        socketService.off(`user_notification_${user.id}`, handleSocketNotification);
      };
    } else {
      socketService.disconnect();
    }
  }, [user]);

  const addNotification = async (title: string, body: string) => {
    const newNotif: StoredNotification = {
      id: Math.random().toString(36).substring(2, 11),
      title,
      body,
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      AsyncStorage.setItem('@skillmatch_notifications_list', JSON.stringify(updated)).catch(err => {
        console.error('AsyncStorage notification error:', err);
      });
      return updated;
    });
  };

  const markNotificationRead = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      AsyncStorage.setItem('@skillmatch_notifications_list', JSON.stringify(updated)).catch(err => {
        console.error('AsyncStorage notification error:', err);
      });
      return updated;
    });
  };

  const markAllNotificationsAsRead = async () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      AsyncStorage.setItem('@skillmatch_notifications_list', JSON.stringify(updated)).catch(err => {
        console.error('AsyncStorage notification error:', err);
      });
      return updated;
    });
  };

  const removeNotification = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      AsyncStorage.setItem('@skillmatch_notifications_list', JSON.stringify(updated)).catch(err => {
        console.error('AsyncStorage notification error:', err);
      });
      return updated;
    });
  };

  const clearNotifications = async () => {
    setNotifications([]);
    await AsyncStorage.removeItem('@skillmatch_notifications_list');
  };

  const loadSettings = async () => {
    try {
      const [storedUser, storedToken, storedTheme, storedLang, storedNotif, storedNotifList, storedOnboarding] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS),
        AsyncStorage.getItem('@skillmatch_notifications_list'),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING),
      ]);

      if (storedUser) setUserState(JSON.parse(storedUser));
      if (storedToken) setTokenState(storedToken);
      if (storedTheme) setThemePrefState(storedTheme as 'system' | 'light' | 'dark');
      if (storedLang) setLangState(storedLang as Language);
      if (storedNotif !== null) setNotifState(storedNotif === 'true');
      if (storedNotifList) setNotifications(JSON.parse(storedNotifList));
      if (storedOnboarding === 'true') setHasSeenOnboardingState(true);

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
      setThemePrefState('system');
      await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
    }
  };

  const setThemePreference = async (pref: 'system' | 'light' | 'dark') => {
    setThemePrefState(pref);
    await AsyncStorage.setItem(STORAGE_KEYS.THEME, pref);
    if (user) {
      try {
        const updateRes = await api.updateUserProfile(user.id, { theme: pref });
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
        const updateRes = await api.updateUserProfile(user.id, { language: lang });
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
        const updateRes = await api.updateUserProfile(user.id, { notification_enabled: enabled });
        setUserState(updateRes.user);
        await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updateRes.user));
      } catch (e) {
        console.error('Failed to sync notifications to server:', e);
      }
    }
  };

  // Resolve theme
  const setHasSeenOnboarding = async (val: boolean) => {
    setHasSeenOnboardingState(val);
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING, val ? 'true' : 'false');
  };

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
        notifications,
        clearNotifications,
        removeNotification,
        markNotificationRead,
        markAllNotificationsAsRead,
        addNotification,
        hasSeenOnboarding,
        setHasSeenOnboarding,
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
