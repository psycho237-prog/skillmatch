import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { api, resolveImageUrl } from '../../src/services/api';
import { socketService } from '../../src/services/socket';
import { getLocalConversations, saveConversationsLocally, getLocalMessages } from '../../src/services/localDb';

export default function ChatList() {
  const { colors, t, user } = useApp();
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      socketService.connect(user.id);
      fetchConversations();

      // Listen for incoming messages to update list order/notification
      socketService.on('new_message', () => {
        fetchConversations();
      });
    }

    return () => {
      socketService.off('new_message', fetchConversations);
    };
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Load local first for instant UI
      const localConvs = await getLocalConversations();
      if (localConvs.length > 0) {
         setConversations(localConvs.map(c => ({
           ...c, 
           other_user: c.user1_id === user.id ? { id: c.user2_id } : { id: c.user1_id }, // minimal stub
           last_message: c.last_message ? JSON.parse(c.last_message) : null
         })));
      }

      const res = await api.getConversations(user.id);
      let apiConvs = res.conversations || [];
      
      // Update each conversation's last_message from local SQLite
      for (const conv of apiConvs) {
         const msgs = await getLocalMessages(conv.id);
         if (msgs && msgs.length > 0) {
            conv.last_message = msgs[msgs.length - 1];
         }
      }
      
      await saveConversationsLocally(apiConvs);
      setConversations(apiConvs);
    } catch (e) {
      console.error(e);
      const localConvs = await getLocalConversations();
      if (localConvs.length > 0) {
        setConversations(localConvs.map(c => ({
           ...c, 
           other_user: c.user1_id === user.id ? { id: c.user2_id } : { id: c.user1_id }, 
           last_message: c.last_message ? JSON.parse(c.last_message) : null
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = (id: string) => {
    // Delete logically or visually
    setConversations(prev => prev.filter(c => c.id !== id));
    // Usually calls API here e.g. api.deleteConversation(id)
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.convItem, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/chat/${item.id}`)}
      onLongPress={() => {
        Alert.alert(
          'Delete Chat', 
          'Are you sure you want to delete this conversation?', 
          [
            { text: 'Cancel', style: 'cancel' }, 
            { text: 'Delete', style: 'destructive', onPress: () => deleteChat(item.id) }
          ]
        );
      }}
    >
      <Image 
        source={{ uri: resolveImageUrl(item.other_user?.avatar_url) }} 
        style={styles.avatar} 
      />
      <View style={styles.convContent}>
        <View style={styles.convHeader}>
          <Typography variant="h6" color={colors.black1} numberOfLines={1} style={{ flex: 1 }}>
            {item.other_user?.display_name || 'Unknown'}
          </Typography>
          <Typography variant="caption" color={colors.black3}>
             {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </View>
        <View style={styles.messageRow}>
          <Typography variant="body2" color={colors.black2} numberOfLines={1} style={{ flex: 1 }}>
            {item.last_message?.content || 'Started a conversation'}
          </Typography>
          {item.unread_count > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Typography variant="caption" color="#FFF">{item.unread_count}</Typography>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Typography variant="h4" style={styles.title}>{t('messages')}</Typography>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={fetchConversations}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Typography variant="body1" color={colors.black2} align="center">
                {t('no_conversations_desc')}
              </Typography>
            </View>
          ) : null
        }
      />
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
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  title: {
    textAlign: 'center',
  },
  list: {
    padding: 24,
  },
  convItem: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  convContent: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  }
});
