import React from 'react';
import { Tabs } from 'expo-router';
import { Image, StyleSheet } from 'react-native';
import { useApp } from '../../src/contexts/AppContext';
import { icons } from '../../src/constants';

export default function AdminLayout() {
  const { colors } = useApp();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.black3,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          height: 60,
          paddingBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => (
            <Image source={icons.barChart} style={[styles.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color }) => (
            <Image source={icons.people} style={[styles.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => (
            <Image source={icons.wallet} style={[styles.icon, { tintColor: color }]} />
          ),
        }}
      />
      <Tabs.Screen
        name="disputes"
        options={{
          title: 'Disputes',
          tabBarIcon: ({ color }) => (
            <Image source={icons.shield} style={[styles.icon, { tintColor: color }]} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { width: 24, height: 24, resizeMode: 'contain' }
});
