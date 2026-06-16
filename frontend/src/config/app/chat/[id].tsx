import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../../contexts/AppContext';
import { Typography } from '../../../components/Typography';
import { Button } from '../../../components/Button';
import { icons } from '../../../constants';
import { socketService } from '../../../services/socket';
import { api, resolveImageUrl } from '../../../services/api';
import { Language } from '../../../i18n/translations';

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, user, t, theme, setTheme, setLanguage } = useApp();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Escrow & Conversation state
  const [conversation, setConversation] = useState<any>(null);
  const [escrow, setEscrow] = useState<any>(null);
  const [loadingEscrow, setLoadingEscrow] = useState(false);

  // Dispute modal state
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeHasProof, setDisputeHasProof] = useState(false);
  const [disputeProofUrl, setDisputeProofUrl] = useState('');

  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingRevieweeId, setRatingRevieweeId] = useState('');
  const [ratingRevieweeName, setRatingRevieweeName] = useState('');

  useEffect(() => {
    if (!user) return;
    
    const isNew = id.toString().startsWith('new_');
    const actualConvId = isNew ? null : id as string;

    if (actualConvId) {
      socketService.joinConversation(actualConvId);
      fetchMessages();
      loadConversationAndEscrow();

      socketService.on('new_message', (message: any) => {
        if (message.conversation_id === actualConvId) {
          setMessages(prev => [...prev, message]);
          socketService.markRead({ conversation_id: actualConvId, user_id: user.id });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });
    }

    // Polling active escrow & conversation details every 4 seconds for sandbox webhook callbacks
    const interval = setInterval(() => {
      if (actualConvId) {
        loadConversationAndEscrow();
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      if (actualConvId) {
        socketService.leaveConversation(actualConvId);
      }
    };
  }, [id, user]);

  const loadConversationAndEscrow = async () => {
    if (!user || id.toString().startsWith('new_')) return;
    try {
      const convRes = await api.getConversationDetail(id as string);
      setConversation(convRes.conversation);

      if (convRes.conversation.service_id) {
        const escrowRes = await api.getActiveEscrow(id as string);
        setEscrow(escrowRes.escrow);
      }
    } catch (e) {
      console.warn('Failed to load escrow details:', e);
    }
  };

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
      sender: user
    }]);
    setInput('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (!isNew) {
      socketService.sendMessage(messageData);
    }
  };

  // Escrow Handler operations
  const handleInitiateEscrow = async () => {
    if (!conversation || !user) return;
    try {
      setLoadingEscrow(true);
      const otherUserId = user.id === conversation.user1_id ? conversation.user2_id : conversation.user1_id;
      await api.initiateEscrow(conversation.service_id, otherUserId, conversation.id);
      Alert.alert("Success", "Transaction initiated successfully. Waiting for counterparty to accept.");
      loadConversationAndEscrow();
      fetchMessages();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to initiate transaction");
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleAcceptEscrow = async () => {
    if (!escrow) return;
    try {
      setLoadingEscrow(true);
      await api.acceptEscrow(escrow.id);
      Alert.alert("Deposit Requested", "Payment deposit requested. Please confirm the mobile money payment prompt on your phone.");
      loadConversationAndEscrow();
      fetchMessages();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to accept transaction");
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!escrow) return;
    try {
      setLoadingEscrow(true);
      await api.markEscrowDelivered(escrow.id);
      Alert.alert("Delivered", "Task marked as delivered. Awaiting client confirmation.");
      loadConversationAndEscrow();
      fetchMessages();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update status");
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleConfirmEscrow = async () => {
    if (!escrow || !user || !conversation) return;
    try {
      setLoadingEscrow(true);
      await api.confirmEscrow(escrow.id);
      Alert.alert("Completed!", "Escrow completed successfully. Funds released.");
      loadConversationAndEscrow();
      fetchMessages();

      // Trigger rating modal immediately
      const revieweeId = user.id === escrow.initiator_id ? escrow.counterparty_id : escrow.initiator_id;
      const revieweeName = user.id === conversation.user1_id ? conversation.user2_name : conversation.user1_name;
      setRatingRevieweeId(revieweeId);
      setRatingScore(5);
      setRatingComment('');
      setRatingModalVisible(true);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to confirm transaction");
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleDispute = () => {
    setDisputeHasProof(false);
    setDisputeProofUrl('');
    setDisputeModalVisible(true);
  };

  const handleSubmitDispute = async () => {
    if (!escrow) return;
    try {
      setLoadingEscrow(true);
      setDisputeModalVisible(false);
      await api.disputeEscrow(escrow.id, disputeHasProof, disputeHasProof ? disputeProofUrl : undefined);
      Alert.alert("Dispute Logged", disputeHasProof ? "Dispute logged with proof. 72h freeze applied." : "Dispute logged without proof. Auto-resolves in 24h.");
      loadConversationAndEscrow();
      fetchMessages();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to raise dispute");
    } finally {
      setLoadingEscrow(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!escrow || !ratingRevieweeId) return;
    try {
      setSubmittingRating(true);
      await api.submitRating(escrow.id, ratingRevieweeId, ratingScore, ratingComment);
      Alert.alert("Thank you", "Your rating was submitted.");
      setRatingModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleSkipRating = () => {
    setRatingModalVisible(false);
  };

  const renderEscrowActions = () => {
    if (loadingEscrow) {
      return <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 12 }} />;
    }

    if (!escrow) {
      // Show Initiate Transaction button
      return (
        <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.primary }]} onPress={handleInitiateEscrow}>
          <Typography variant="body2" color="white" weight="bold">INITIATE TRANSACTION</Typography>
        </TouchableOpacity>
      );
    }

    const isProvider = (user?.id === conversation?.service_owner_id);
    const isClient = !isProvider;

    if (escrow.status === 'AWAITING_COUNTERPARTY') {
      const isCounterparty = (user?.id === escrow.counterparty_id);
      if (isCounterparty) {
        return (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.primary, marginRight: 8 }]} onPress={handleAcceptEscrow}>
              <Typography variant="caption" color="white" weight="bold">ACCEPT</Typography>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.danger }]} onPress={() => Alert.alert("Decline", "Escrow declined by counterparty.")}>
              <Typography variant="caption" color="white" weight="bold">DECLINE</Typography>
            </TouchableOpacity>
          </View>
        );
      } else {
        return (
          <Typography variant="caption" color={colors.black3} style={styles.escrowStatusText}>
            Waiting for accept...
          </Typography>
        );
      }
    }

    if (escrow.status === 'BOTH_LOCKED') {
      if (isProvider) {
        return (
          <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.primary }]} onPress={handleMarkDelivered}>
            <Typography variant="body2" color="white" weight="bold">MARK DELIVERED 📦</Typography>
          </TouchableOpacity>
        );
      } else {
        return (
          <Typography variant="body2" color={colors.primary} weight="bold" style={styles.escrowStatusText}>
            Locked 🔒
          </Typography>
        );
      }
    }

    if (escrow.status === 'PROVIDER_MARKED_DONE') {
      if (isClient) {
        return (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.primary, marginRight: 8 }]} onPress={handleConfirmEscrow}>
              <Typography variant="caption" color="white" weight="bold">CONFIRM ✅</Typography>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.danger }]} onPress={handleDispute}>
              <Typography variant="caption" color="white" weight="bold">DISPUTE ⚠️</Typography>
            </TouchableOpacity>
          </View>
        );
      } else {
        return (
          <Typography variant="caption" color={colors.black3} style={styles.escrowStatusText}>
            Delivered. Awaiting confirm...
          </Typography>
        );
      }
    }

    // Fallbacks
    return (
      <Typography variant="caption" color={colors.primary} weight="bold" style={styles.escrowStatusText}>
        Status: {escrow.status}
      </Typography>
    );
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
    // Render system log message
    if (item.sender_id === null) {
      return (
        <View style={styles.systemMsgWrapper}>
          <View style={[styles.systemMsgBubble, { backgroundColor: colors.border }]}>
            <Typography variant="body2" color={colors.black2} style={{ textAlign: 'center' }}>
              {item.content}
            </Typography>
          </View>
        </View>
      );
    }

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
          {formatTime(item.created_at)}
        </Typography>
      </View>
    );
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
        <Typography variant="h5" style={styles.title}>{t('conversation')}</Typography>
        <TouchableOpacity style={styles.backBtn} onPress={() => setShowSettings(true)}>
          <Image source={icons.info} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
      </View>
      
      {/* Conversation timeline messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
      />

      {/* Escrow Status Bar */}
      {conversation && conversation.service_id && (
        <View style={[styles.escrowBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.escrowTextCol}>
            <Typography variant="body2" weight="bold">
              Service: "{conversation.service_title}" — {conversation.service_price} {conversation.currency || 'XAF'}
            </Typography>
            <Typography variant="caption" color={colors.black3}>
              Commitment Hold: {conversation.holdup_amount} {conversation.currency || 'XAF'}
            </Typography>
          </View>
          {renderEscrowActions()}
        </View>
      )}

      {/* Message Input panel */}
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

      {/* Settings drop down modal */}
      <Modal transparent visible={showSettings} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowSettings(false)}>
          <View style={styles.modalOverlay}>
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

      {/* Dispute Modal */}
      <Modal visible={disputeModalVisible} transparent animationType="slide" onRequestClose={() => setDisputeModalVisible(false)}>
        <Pressable style={styles.disputeOverlay} onPress={() => setDisputeModalVisible(false)}>
          <View style={[styles.disputeContent, { backgroundColor: colors.background }]}>
            <Typography variant="h4" style={{ marginBottom: 12 }}>Open Transaction Dispute</Typography>
            <Typography variant="body2" color={colors.black2} style={{ marginBottom: 20 }}>
              Explain why you are opening this dispute. If you possess uploaded proof, check the box and provide the URL.
            </Typography>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
              onPress={() => setDisputeHasProof(!disputeHasProof)}
            >
              <Typography variant="h4" style={{ marginRight: 8 }}>{disputeHasProof ? '☑️' : '⬜'}</Typography>
              <Typography variant="body2" color={colors.black1}>I have uploaded proof of non-delivery</Typography>
            </TouchableOpacity>

            {disputeHasProof && (
              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
                <TextInput
                  placeholder="Paste dispute proof URL here"
                  placeholderTextColor={colors.black3}
                  style={[styles.input, { color: colors.black1 }]}
                  value={disputeProofUrl}
                  onChangeText={setDisputeProofUrl}
                />
              </View>
            )}

            <View style={{ padding: 12, backgroundColor: colors.card, borderRadius: 12, marginBottom: 20 }}>
              <Typography variant="caption" color={colors.danger} weight="bold">
                {disputeHasProof 
                  ? "⚠️ Escrow holds will be frozen for 72 hours. Platform will arbitrate." 
                  : "⚠️ No proof. Transaction will auto-resolve in provider's favor in 24 hours."}
              </Typography>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} 
                onPress={() => setDisputeModalVisible(false)}
              >
                <Typography variant="body2">Cancel</Typography>
              </TouchableOpacity>
              <Button title="Raise Dispute" onPress={handleSubmitDispute} style={{ flex: 1 }} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Ratings Modal */}
      <Modal visible={ratingModalVisible} transparent animationType="slide" onRequestClose={handleSkipRating}>
        <Pressable style={styles.disputeOverlay} onPress={handleSkipRating}>
          <View style={[styles.disputeContent, { backgroundColor: colors.background }]}>
            <Typography variant="h4" style={{ marginBottom: 12 }}>Rate Counterparty</Typography>
            <Typography variant="body2" color={colors.black2} style={{ marginBottom: 20 }}>
              Transaction complete. Leave a rating and review comments for your partner.
            </Typography>

            {/* Stars selection */}
            <View style={styles.starContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)}>
                  <Typography variant="h1" style={{ fontSize: 40, color: star <= ratingScore ? '#FFB800' : colors.border }}>
                    ★
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment field */}
            <Typography variant="body2" weight="bold" style={{ marginBottom: 8, marginTop: 16 }}>Comments (Optional)</Typography>
            <View style={[styles.inputGroup, styles.textAreaGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                placeholder="Describe your experience..."
                placeholderTextColor={colors.black3}
                multiline
                numberOfLines={3}
                maxLength={300}
                style={[styles.input, styles.textArea, { color: colors.black1 }]}
                value={ratingComment}
                onChangeText={setRatingComment}
              />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity 
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} 
                onPress={handleSkipRating}
              >
                <Typography variant="body2" color={colors.black2}>Skip</Typography>
              </TouchableOpacity>
              <Button 
                title="Submit Rating" 
                onPress={handleSubmitRating} 
                loading={submittingRating}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </View>
        </Pressable>
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
    paddingBottom: 20,
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
  },
  escrowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  escrowTextCol: {
    flex: 1,
    marginRight: 8,
  },
  escrowActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  escrowStatusText: {
    fontSize: 12,
    textAlign: 'right',
  },
  systemMsgWrapper: {
    alignItems: 'center',
    marginVertical: 12,
    width: '100%',
  },
  systemMsgBubble: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    maxWidth: '85%',
  },
  disputeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  disputeContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
  },
  inputGroup: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textAreaGroup: { height: 80, alignItems: 'flex-start', paddingTop: 8 },
  textArea: { textAlignVertical: 'top' },
  modalBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
});
