import React from 'react';
import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { useApp } from '../../../contexts/AppContext';
import { icons } from '../../../constants';

export default function TabLayout() {
  const { colors, t } = useApp();

  return (
    
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.black3,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 20,
          paddingTop: 10,
          elevation: 0, // Android shadow off to match ios
          shadowOpacity: 0,
          marginBottom: 40,
        },
        tabBarLabelStyle: {
          fontFamily: 'Rubik-Medium',
          fontSize: 10,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('app_name'), // It's invisible technically, tabBarLabel is what we want
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={icons.home}
              style={[styles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('explore'),
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={icons.search}
              style={[styles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('chat'),
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={icons.chat}
              style={[styles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={icons.wallet}
              style={[styles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={icons.person}
              style={[styles.icon, { tintColor: color }]}
              resizeMode="contain"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 24,
    height: 24,
  },
});
