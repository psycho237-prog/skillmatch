import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, FlatList, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../contexts/AppContext';
import { Typography } from '../../components/Typography';
import { icons } from '../../constants';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors, notifications, clearNotifications, removeNotification, markNotificationRead, markAllNotificationsAsRead, t } = useApp();

  // Mark all as read when opening the screen
  useEffect(() => {
    markAllNotificationsAsRead();
  }, []);

  const handleClearAll = () => {
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearNotifications }
      ]
    );
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>&lt; Back</Typography>
        </TouchableOpacity>
        <Typography variant="h4">Notifications</Typography>
        {notifications.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Typography variant="body2" color={colors.danger} weight="medium">Clear All</Typography>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              {
                backgroundColor: item.read ? colors.card : colors.primary + '0a',
                borderColor: item.read ? colors.border : colors.primary + '30'
              }
            ]}
            onPress={() => markNotificationRead(item.id)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                <Typography variant="h6" color={colors.black1} weight={item.read ? 'medium' : 'bold'} style={{ flex: 1 }}>
                  {item.title}
                </Typography>
              </View>
              <Typography variant="caption" color={colors.black3}>{formatTime(item.timestamp)}</Typography>
            </View>

            <Typography variant="body2" color={colors.black2} style={styles.body}>
              {item.body}
            </Typography>

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => removeNotification(item.id)}
            >
              <Typography variant="caption" color={colors.danger} weight="bold">Delete</Typography>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Typography variant="h1" style={{ fontSize: 60, marginBottom: 16 }}>🔔</Typography>
            <Typography variant="h5" color={colors.black2} style={{ marginBottom: 8 }}>
              No notifications yet
            </Typography>
            <Typography variant="body2" color={colors.black3} align="center">
              We'll notify you here when transaction updates and wallet deposits complete.
            </Typography>
          </View>
        }
        contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { width: 80 },
  clearBtn: { width: 80, alignItems: 'flex-end' },
  placeholder: { width: 80 },
  card: {
    marginHorizontal: 24,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  body: {
    lineHeight: 18,
    marginBottom: 8,
  },
  deleteBtn: {
    alignSelf: 'flex-end',
    paddingTop: 4,
    paddingLeft: 12,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },
});
