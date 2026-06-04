import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { icons } from '../../src/constants';
import { socketService } from '../../src/services/socket';
import { api } from '../../src/services/api';

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, user } = useApp();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    
    // Only connect if it's a real conversation ID
    if (!id.toString().startsWith('new_')) {
      socketService.joinConversation(id as string);
      fetchMessages();

      socketService.on('new_message', (message: any) => {
        if (message.conversation_id === id) {
          setMessages(prev => [...prev, message]);
          socketService.markRead({ conversation_id: id as string, user_id: user.id });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });
    }

    return () => {
      if (!id.toString().startsWith('new_')) {
        socketService.leaveConversation(id as string);
      }
    };
  }, [id, user]);

  const fetchMessages = async () => {
    try {
      const res = await api.getMessages(id as string);
      setMessages(res.messages || []);
      // Mark as read after fetching
      if (user) {
         socketService.markRead({ conversation_id: id as string, user_id: user.id });
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      console.error(e);
      // Dummy data for visual
      setMessages([
        { id: '1', sender_id: 'other', content: 'Hi, I am interested in your service.', created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: '2', sender_id: user?.id, content: 'Hello! I would be happy to help. What do you need?', created_at: new Date(Date.now() - 3500000).toISOString() }
      ]);
    }
  };

  const handleSend = () => {
    if (!input.trim() || !user) return;
    
    const isNew = id.toString().startsWith('new_');
    const actualConvId = isNew ? id.toString().split('_')[1] : id;
    
    const messageData = {
      conversation_id: actualConvId as string,
      sender_id: user.id,
      content: input.trim(),
    };

    // Optimistic UI
    setMessages(prev => [...prev, { ...messageData, id: Date.now().toString(), created_at: new Date().toISOString() }]);
    setInput('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // If it's a completely new chat we would need to generate the conversation server-side first
    // Since we create conversation enthusiastically going into this screen, 'new_' should mostly apply when backend was down in demo.
    if (!isNew) {
      socketService.sendMessage(messageData);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        <View style={[
          styles.msgBubble, 
          { backgroundColor: isMe ? colors.primary : colors.card },
          isMe ? styles.bubbleRight : styles.bubbleLeft
        ]}>
          <Typography variant="body1" color={isMe ? '#FFF' : colors.black1}>
            {item.content}
          </Typography>
        </View>
        <Typography variant="caption" color={colors.black3} style={{ marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
        <Typography variant="h5" style={styles.title}>Conversation</Typography>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
          <TextInput
            style={[styles.input, { color: colors.black1 }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.black3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]} 
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Image source={icons.send} style={[styles.sendIcon, { tintColor: '#FFF' }]} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  chatList: {
    padding: 24,
    paddingBottom: 20,
  },
  msgWrapper: {
    marginBottom: 20,
    maxWidth: '80%',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  msgBubble: {
    padding: 16,
  },
  bubbleLeft: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    minHeight: 56,
    maxHeight: 120,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginRight: 12,
  },
  input: {
    fontFamily: 'Rubik-Regular',
    fontSize: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    width: 24,
    height: 24,
    marginLeft: 4, // Visual balance for send icon geometry
  }
});
