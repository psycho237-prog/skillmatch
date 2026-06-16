import React, { useEffect, useState, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, Image, Platform, View } from 'react-native';
import { Typography } from './Typography';
import { useApp } from '../contexts/AppContext';
import { socketService } from '../services/socket';
import { useRouter } from 'expo-router';

export function NotificationBanner() {
  const [notification, setNotification] = useState<{ title: string; body: string; data?: any } | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const { colors, user } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const handleNewMessage = (msg: any) => {
      // Don't notify if I sent it
      if (msg.sender_id === user.id) return;
      
      showNotification(
        'New Message',
        msg.content,
        { type: 'chat', id: msg.conversation_id }
      );
    };

    socketService.on('new_message', handleNewMessage);

    return () => {
      // cleanup
    };
  }, [user]);

  // Method to trigger it globally if needed
  const showNotification = (title: string, body: string, data?: any) => {
    setNotification({ title, body, data });
    Animated.spring(translateY, {
      toValue: Platform.OS === 'ios' ? 50 : 30,
      useNativeDriver: true,
      bounciness: 10,
    }).start();

    // Auto hide after 4 seconds
    setTimeout(() => {
      hideNotification();
    }, 4000);
  };

  const hideNotification = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  const handleTap = () => {
    hideNotification();
    if (notification?.data?.type === 'chat') {
      router.push(`/chat/${notification.data.id}`);
    }
  };

  if (!notification) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], backgroundColor: colors.card, shadowColor: colors.shadow }]}>
      <TouchableOpacity activeOpacity={0.8} onPress={handleTap} style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary }]}>
          <Typography variant="body2" color="#FFF">🔔</Typography>
        </View>
        <View style={styles.textContainer}>
          <Typography variant="body1" style={{ fontFamily: 'Rubik-Medium' }}>{notification.title}</Typography>
          <Typography variant="caption" color={colors.black2} numberOfLines={2}>{notification.body}</Typography>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    borderRadius: 16,
    zIndex: 9999,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  content: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  }
});
