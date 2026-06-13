import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { icons, images } from '../../src/constants';
import { socketService } from '../../src/services/socket';
import { api } from '../../src/services/api';
import { Language } from '../../src/i18n/translations';

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, user, t, theme, setTheme, setLanguage } = useApp();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    
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
      if (user) {
         socketService.markRead({ conversation_id: id as string, user_id: user.id });
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (e) {
      console.error(e);
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

    setMessages(prev => [...prev, { 
      ...messageData, 
      id: Date.now().toString(), 
      created_at: new Date().toISOString(),
      sender: user // Attach sender for immediate UI display
    }]);
    setInput('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (!isNew) {
      socketService.sendMessage(messageData);
    }
  };

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
    setShowSettings(false);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
    setShowSettings(false);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender_id === user?.id;
    const senderAvatar = item.sender?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp';

    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
        <View style={[styles.bubbleContainer, isMe ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
          <Image source={{ uri: senderAvatar }} style={styles.bubbleAvatar} />
          <View style={[
            styles.msgBubble, 
            { backgroundColor: isMe ? colors.primary : colors.card },
            isMe ? styles.bubbleRight : styles.bubbleLeft
          ]}>
            <Typography variant="body1" color={isMe ? '#FFF' : colors.black1}>
              {item.content}
            </Typography>
          </View>
        </View>
        <Typography variant="caption" color={colors.black3} style={{ marginTop: 4, marginLeft: isMe ? 0 : 44, marginRight: isMe ? 44 : 0 }}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
        <Typography variant="h5" style={styles.title}>{t('conversation')}</Typography>
        <TouchableOpacity style={styles.backBtn} onPress={() => setShowSettings(true)}>
          <Image source={icons.info} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
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
            placeholder={t('type_message')}
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

      <Modal transparent visible={showSettings} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowSettings(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Typography variant="h6" style={styles.dropdownTitle}>{t('chat_settings')}</Typography>
              
              <TouchableOpacity style={styles.dropdownItem} onPress={toggleTheme}>
                <Typography variant="body2">{t('theme')}: {t(theme === 'dark' ? 'theme_dark' : 'theme_light')}</Typography>
              </TouchableOpacity>
              
              <View style={styles.divider} />
              
              <Typography variant="caption" color={colors.black3} style={styles.dropdownLabel}>{t('language')}</Typography>
              <View style={styles.langGrid}>
                {(['en', 'fr', 'de', 'es', 'zh', 'ru'] as Language[]).map((lang) => (
                  <TouchableOpacity key={lang} style={[styles.langBtn, { backgroundColor: colors.inputBg }]} onPress={() => changeLanguage(lang)}>
                    <Typography variant="caption">{lang.toUpperCase()}</Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
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
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 40,
  },
  msgWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  bubbleContainer: {
    alignItems: 'center',
  },
  bubbleAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: 8,
  },
  msgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
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
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'Rubik-Regular',
    fontSize: 15,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    width: 20,
    height: 20,
    marginLeft: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 110,
    paddingRight: 24,
  },
  dropdown: {
    width: 200,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownTitle: {
    marginBottom: 12,
  },
  dropdownItem: {
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginVertical: 4,
  },
  dropdownLabel: {
    marginTop: 8,
    marginBottom: 8,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  langBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 40,
    alignItems: 'center',
  }
});
