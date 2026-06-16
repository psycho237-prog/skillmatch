import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback, Alert, Keyboard, Animated, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { icons } from '../../src/constants';
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
  const [showProposeModal, setShowProposeModal] = useState(false);
  
  // Transaction states
  const [offerAmount, setOfferAmount] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [processingOffer, setProcessingOffer] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

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
    } else {
      // If new_ chat, figure out other user ID from the ID parameter format (e.g. new_123)
      setOtherUserId(id.toString().split('_')[1]);
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
      
      // Determine other user from messages if not known
      if (res.messages && res.messages.length > 0) {
        const otherMsg = res.messages.find((m: any) => m.sender_id !== user?.id);
        if (otherMsg) setOtherUserId(otherMsg.sender_id);
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
      sender: user
    }]);
    setInput('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (!isNew) {
      socketService.sendMessage(messageData);
    }
  };

  const uploadAndSend = async (uri: string, name: string, mimeType: string, prefix: string) => {
    setUploadingMedia(true);
    try {
      const uploadRes = await api.uploadFiles([{ uri, name, mimeType }]);
      const serverUrl = uploadRes.urls[0];
      
      const isNew = id.toString().startsWith('new_');
      const actualConvId = isNew ? id.toString().split('_')[1] : id;
      
      const content = prefix === '[FILE]' ? `${prefix}${name}|${serverUrl}` : `${prefix}${serverUrl}`;
      
      const messageData = {
        conversation_id: actualConvId as string,
        sender_id: user?.id,
        content,
      };

      setMessages(prev => [...prev, { 
        ...messageData, 
        id: Date.now().toString(), 
        created_at: new Date().toISOString(),
        sender: user
      }]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      if (!isNew) {
        socketService.sendMessage(messageData);
      }
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Could not send file');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handlePickGallery = async () => {
    setShowAttachModal(false);
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const name = uri.split('/').pop() || 'image.jpg';
      await uploadAndSend(uri, name, 'image/jpeg', '[IMAGE]');
    }
  };

  const handleTakePic = async () => {
    setShowAttachModal(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const name = uri.split('/').pop() || 'camera_image.jpg';
      await uploadAndSend(uri, name, 'image/jpeg', '[IMAGE]');
    }
  };

  const handlePickDocument = async () => {
    setShowAttachModal(false);
    let result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      const file = result.assets[0];
      await uploadAndSend(file.uri, file.name, file.mimeType || 'application/pdf', '[FILE]');
    }
  };

  const handleProposeOffer = async () => {
    if (!offerAmount || !offerTitle || !otherUserId || !user) {
      Alert.alert('Error', 'Please fill out all required fields.');
      return;
    }

    setProcessingOffer(true);
    try {
      // Create a Cash for Skill transaction
      await api.createTransaction({
        type: 'cash_for_skill',
        provider_id: user.id, // Assuming the proposer is the provider for now
        beneficiary_id: otherUserId, // The other person is paying
        service_id: null, // Optional unless specific service
        title: offerTitle,
        description: offerDescription,
        amount: Number(offerAmount),
      });

      Alert.alert('Offer Sent!', 'The transaction proposal has been sent. Waiting for the other party to accept and lock funds in escrow.');
      setShowProposeModal(false);
      setOfferAmount('');
      setOfferTitle('');
      setOfferDescription('');
      
      // Send a system message to the chat
      const sysMsg = `🤝 Transaction Proposed: ${offerTitle} for ${offerAmount} XAF.`;
      const actualConvId = id.toString().startsWith('new_') ? id.toString().split('_')[1] : id;
      socketService.sendMessage({
        conversation_id: actualConvId as string,
        sender_id: user.id,
        content: sysMsg,
      });

      setMessages(prev => [...prev, { 
        conversation_id: actualConvId,
        sender_id: user.id,
        content: sysMsg,
        id: Date.now().toString(), 
        created_at: new Date().toISOString(),
        sender: user
      }]);

    } catch (error: any) {
      Alert.alert('Failed to send offer', error.message || 'Something went wrong.');
    } finally {
      setProcessingOffer(false);
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
    const isSystem = item.content.startsWith('🤝');
    const isImage = item.content.startsWith('[IMAGE]');
    const isFile = item.content.startsWith('[FILE]');
    
    let actualContent = item.content;
    let fileName = '';
    
    if (isImage) {
      actualContent = item.content.replace('[IMAGE]', '');
    } else if (isFile) {
      const parts = item.content.replace('[FILE]', '').split('|');
      fileName = parts[0];
      actualContent = parts[1] || parts[0];
    }
    
    return (
      <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft, isSystem && { alignSelf: 'center', maxWidth: '90%' }]}>
        <View style={[styles.bubbleContainer, isMe ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
          {!isSystem && <Image source={{ uri: item.sender?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp' }} style={styles.bubbleAvatar} />}
          <View style={[
            styles.msgBubble, 
            isImage && { paddingHorizontal: 4, paddingVertical: 4, backgroundColor: 'transparent' },
            isSystem ? [styles.systemBubble, { backgroundColor: colors.primary + '15', borderColor: colors.primary }] :
            (!isImage && isMe) ? [styles.bubbleRight, { backgroundColor: '#007AFF' }] : 
            (!isImage && !isMe) ? [styles.bubbleLeft, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#E5E5EA' }] : {}
          ]}>
            {isImage ? (
              <Image source={{ uri: actualContent }} style={{ width: 220, height: 220, borderRadius: 16 }} />
            ) : isFile ? (
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Typography variant="h5" color={isMe ? '#FFF' : colors.primary} style={{marginRight: 8}}>📄</Typography>
                <Typography variant="body2" color={isMe ? '#FFF' : (theme === 'dark' ? '#FFF' : '#000')} style={{textDecorationLine: 'underline', flexShrink: 1}}>
                  {fileName}
                </Typography>
              </View>
            ) : (
              <Typography variant="body1" color={isSystem ? colors.primary : isMe ? '#FFF' : (theme === 'dark' ? '#FFF' : '#000')}>
                {actualContent}
              </Typography>
            )}
          </View>
        </View>
        <Typography variant="caption" color={colors.black3} style={{ marginTop: 4, textAlign: isSystem ? 'center' : isMe ? 'right' : 'left', marginLeft: isMe || isSystem ? 0 : 44, marginRight: isMe && !isSystem ? 44 : 0 }}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* iOS Style Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.primary }]} />
          <Typography variant="body1" color={colors.primary} style={{marginLeft: -5}}>Back</Typography>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Typography variant="h6" style={styles.title}>{t('conversation')}</Typography>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowProposeModal(true)}>
            <Image source={icons.wallet} style={[styles.headerIcon, { tintColor: colors.primary }]} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <Image source={icons.info} style={[styles.headerIcon, { tintColor: colors.primary }]} />
          </TouchableOpacity>
        </View>
      </View>
      
      <Animated.FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      />

      {/* iOS Style Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachModal(true)} disabled={uploadingMedia}>
          {uploadingMedia ? (
            <ActivityIndicator size="small" color={colors.black3} />
          ) : (
            <Typography variant="h4" color={colors.black3}>+</Typography>
          )}
        </TouchableOpacity>
        
        <View style={[styles.inputWrapper, { backgroundColor: theme === 'dark' ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.black1 }]}
            placeholder="iMessage"
            placeholderTextColor={colors.black3}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.sendBtn, { backgroundColor: input.trim() ? '#007AFF' : 'transparent' }]} 
          onPress={handleSend}
          disabled={!input.trim()}
        >
          {input.trim() ? (
            <Image source={icons.send} style={[styles.sendIcon, { tintColor: '#FFF' }]} />
          ) : (
             <Image source={icons.camera} style={[styles.sendIcon, { tintColor: colors.black3, width: 24, height: 24 }]} />
          )}
        </TouchableOpacity>
      </View>

      {/* Propose Offer Modal */}
      <Modal visible={showProposeModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Typography variant="h5" style={{fontFamily: 'Rubik-Bold'}}>Propose Transaction</Typography>
              <TouchableOpacity onPress={() => setShowProposeModal(false)}>
                <Typography variant="body1" color={colors.primary}>Cancel</Typography>
              </TouchableOpacity>
            </View>

            <Typography variant="body2" color={colors.black3} style={{ marginBottom: 20 }}>
              Create a smart contract. The buyer will lock the funds securely in escrow until the service is delivered.
            </Typography>

            <View style={styles.inputGroup}>
              <Typography variant="caption" color={colors.black2} style={{marginBottom: 8}}>Service Title</Typography>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.black1 }]}
                placeholder="e.g. Logo Design"
                placeholderTextColor={colors.black3}
                value={offerTitle}
                onChangeText={setOfferTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Typography variant="caption" color={colors.black2} style={{marginBottom: 8}}>Amount (XAF)</Typography>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.black1, fontSize: 20, fontFamily: 'Rubik-Medium' }]}
                placeholder="0"
                placeholderTextColor={colors.black3}
                keyboardType="numeric"
                value={offerAmount}
                onChangeText={setOfferAmount}
              />
            </View>

            <View style={styles.inputGroup}>
              <Typography variant="caption" color={colors.black2} style={{marginBottom: 8}}>Description (Optional)</Typography>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.border, color: colors.black1, height: 80 }]}
                placeholder="Details of the agreement..."
                placeholderTextColor={colors.black3}
                multiline
                value={offerDescription}
                onChangeText={setOfferDescription}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: processingOffer ? 0.7 : 1 }]} 
              onPress={handleProposeOffer}
              disabled={processingOffer}
            >
              <Typography variant="h6" color="#FFF">{processingOffer ? 'Sending...' : 'Send Proposal'}</Typography>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attach Modal */}
      <Modal transparent visible={showAttachModal} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowAttachModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
              <View style={styles.actionSheetHandle} />
              
              <TouchableOpacity style={styles.actionSheetBtn} onPress={handleTakePic}>
                <Typography variant="h5" style={{marginRight: 12}}>📷</Typography>
                <Typography variant="body1" color={colors.black1} style={{fontFamily: 'Rubik-Medium'}}>Take Photo</Typography>
              </TouchableOpacity>
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <TouchableOpacity style={styles.actionSheetBtn} onPress={handlePickGallery}>
                <Typography variant="h5" style={{marginRight: 12}}>🖼️</Typography>
                <Typography variant="body1" color={colors.black1} style={{fontFamily: 'Rubik-Medium'}}>Choose from Gallery</Typography>
              </TouchableOpacity>
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <TouchableOpacity style={styles.actionSheetBtn} onPress={handlePickDocument}>
                <Typography variant="h5" style={{marginRight: 12}}>📄</Typography>
                <Typography variant="body1" color={colors.black1} style={{fontFamily: 'Rubik-Medium'}}>Upload Document</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Settings Modal */}
      <Modal transparent visible={showSettings} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowSettings(false)}>
          <View style={styles.settingsOverlay}>
            <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Typography variant="h6" style={styles.dropdownTitle}>{t('chat_settings')}</Typography>
              
              <TouchableOpacity style={styles.dropdownItem} onPress={toggleTheme}>
                <Typography variant="body2">{t('theme')}: {t(theme === 'dark' ? 'theme_dark' : 'theme_light')}</Typography>
              </TouchableOpacity>
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  backIcon: {
    width: 22,
    height: 22,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Rubik-Medium',
  },
  headerRight: {
    flexDirection: 'row',
    width: 80,
    justifyContent: 'flex-end',
  },
  iconBtn: {
    marginLeft: 16,
  },
  headerIcon: {
    width: 22,
    height: 22,
  },
  chatList: {
    padding: 16,
    paddingBottom: 20,
  },
  msgWrapper: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  msgLeft: {
    alignSelf: 'flex-start',
  },
  msgRight: {
    alignSelf: 'flex-end',
  },
  bubbleContainer: {
    alignItems: 'flex-end',
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  msgBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  bubbleLeft: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  systemBubble: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  attachBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 2,
  },
  inputWrapper: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    marginRight: 8,
    justifyContent: 'center',
  },
  input: {
    fontFamily: 'Rubik-Regular',
    fontSize: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendIcon: {
    width: 16,
    height: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontFamily: 'Rubik-Regular',
    fontSize: 16,
  },
  submitBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 16,
  },
  dropdown: {
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownTitle: {
    marginBottom: 12,
    fontFamily: 'Rubik-Medium',
  },
  dropdownItem: {
    paddingVertical: 12,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  dropdownLabel: {
    marginTop: 4,
    marginBottom: 10,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    minWidth: 48,
    alignItems: 'center',
  },
  actionSheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: 12,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CCCCCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  }
});
