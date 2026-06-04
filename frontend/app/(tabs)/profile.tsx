import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { icons } from '../../src/constants';

export default function Profile() {
  const { colors, t, user, setUser, themePreference, setThemePreference, language, setLanguage, notificationsEnabled, setNotificationsEnabled } = useApp();
  const router = useRouter();

  const handleLogout = async () => {
    await setUser(null);
    router.replace('/(auth)/welcome');
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'fr' : 'en');
  };

  const toggleTheme = () => {
    if (themePreference === 'system') setThemePreference('dark');
    else if (themePreference === 'dark') setThemePreference('light');
    else setThemePreference('system');
  };

  const getThemeText = () => {
    if (themePreference === 'system') return t('theme_system');
    if (themePreference === 'dark') return t('theme_dark');
    return t('theme_light');
  };

  const getLangText = () => {
    return language === 'en' ? t('english') : t('french');
  };

  const menuItems = [
    { icon: icons.calendar, title: t('my_services'), action: () => {} },
    { icon: icons.wallet, title: 'Payments (Demo)', action: () => {} },
    { icon: icons.person, title: t('profile'), action: () => {} },
    { 
      icon: icons.bell, 
      title: t('notifications_setting'), 
      rightElement: <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: colors.primary }} /> 
    },
    { icon: icons.shield, title: t('security'), action: () => {} },
    { 
      icon: icons.language, 
      title: t('language'), 
      action: toggleLanguage,
      rightText: getLangText()
    },
    { 
      icon: icons.edit, // Reusing an icon for theme toggle mock
      title: t('theme'), 
      action: toggleTheme,
      rightText: getThemeText()
    },
    { icon: icons.info, title: t('help_center'), action: () => {} },
    { icon: icons.people, title: t('invite_friends'), action: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Typography variant="h4" style={styles.title}>{t('profile')}</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: user?.avatar_url || 'https://via.placeholder.com/150' }} 
              style={styles.avatar} 
            />
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Image source={icons.edit} style={styles.editIcon} />
            </TouchableOpacity>
          </View>
          <Typography variant="h3" style={styles.name}>{user?.display_name}</Typography>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={item.action}
              disabled={!item.action}
            >
              <Image source={item.icon} style={[styles.menuIcon, { tintColor: colors.black1 }]} />
              <Typography variant="h6" color={colors.black1} style={styles.menuTitle}>
                {item.title}
              </Typography>
              {item.rightText && (
                <Typography variant="body2" color={colors.primary} style={styles.rightText}>
                  {item.rightText}
                </Typography>
              )}
              {item.rightElement ? (
                item.rightElement
              ) : (
                <Image source={icons.rightArrow} style={[styles.arrowIcon, { tintColor: colors.black3 }]} />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Image source={icons.logout} style={[styles.menuIcon, { tintColor: colors.danger }]} />
            <Typography variant="h6" color={colors.danger} style={styles.menuTitle}>
              {t('logout')}
            </Typography>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0061FF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF', // Always white to pop
  },
  editIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFF',
  },
  name: {
    marginBottom: 8,
  },
  menuList: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
  },
  arrowIcon: {
    width: 20,
    height: 20,
  },
  rightText: {
    marginRight: 12,
  }
});
