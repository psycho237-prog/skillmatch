import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, FlatList, KeyboardAvoidingView, Platform, Modal, TouchableWithoutFeedback, Alert, Keyboard, Animated, ActivityIndicator, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { icons } from '../../src/constants';
import { socketService } from '../../src/services/socket';
import { api, resolveImageUrl } from '../../src/services/api';
import { Language } from '../../src/i18n/translations';

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, user, t, theme, setTheme, setLanguage } = useApp();
  
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  // Transaction states
  const [offerAmount, setOfferAmount] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [processingOffer, setProcessingOffer] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  // Advanced Chat States
  const [replyingToMessage, setReplyingToMessage] = useState<any>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Escrow & Conversation state
  const [conversation, setConversation] = useState<any>(null);
  const [escrow, setEscrow] = useState<any>(null);
  const [loadingEscrow, setLoadingEscrow] = useState(false);
  const [myConfirmedExchange, setMyConfirmedExchange] = useState(false); // S2S partial confirm tracker

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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (!user) return;
    
    const isNew = id.toString().startsWith('new_');
    const actualConvId = isNew ? null : id as string;

    if (actualConvId) {
      socketService.joinConversation(actualConvId);
      fetchMessages();
      loadConversationAndEscrow();

      socketService.on('new_message', (message: any) => {
        if (message.conversation_id === actualConvId) {
          setMessages(prev => {
            // Check if we already have this exact message by ID
            if (prev.some(m => m.id === message.id)) return prev;
            
            // Find an optimistic message (ID has no hyphens) from the same sender with the same content
            const optimisticIndex = prev.findIndex(m => m.sender_id === message.sender_id && m.content === message.content && !m.id.includes('-'));
            
            if (optimisticIndex !== -1) {
              const newMessages = [...prev];
              newMessages[optimisticIndex] = message;
              return newMessages;
            }
            
            return [...prev, message];
          });
          socketService.markRead({ conversation_id: actualConvId, user_id: user.id });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socketService.on('message_updated', (updatedMsg: any) => {
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m));
      });

      socketService.on('message_error', (data: any) => {
        Alert.alert('Error', data.error);
      });

      socketService.on('user_status', (data: any) => {
        if (data.userId === otherUserId || data.userId === id.toString().split('_')[1]) {
          setIsOnline(data.online);
        }
      });
    } else {
      // If new_ chat, figure out other user ID from the ID parameter format (e.g. new_123)
      setOtherUserId(id.toString().split('_')[1]);
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
    
    if (editingMessageId) {
      // Optimistically update locally
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: input.trim(), is_edited: true } : m));
      
      if (!isNew) {
        socketService.emit('edit_message', {
          message_id: editingMessageId,
          content: input.trim(),
          user_id: user.id,
          conversation_id: actualConvId
        });
      }
      
      setInput('');
      setEditingMessageId(null);
      return;
    }

    const messageData = {
      conversation_id: actualConvId as string,
      sender_id: user.id,
      content: input.trim(),
      reply_to_id: replyingToMessage ? replyingToMessage.id : null,
    };

    setMessages(prev => [...prev, { 
      ...messageData, 
      id: Date.now().toString(), 
      created_at: new Date().toISOString(),
      sender: user,
      reply_to_message: replyingToMessage
    }]);
    
    setInput('');
    setReplyingToMessage(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    if (!isNew) {
      socketService.sendMessage(messageData);
    }
  };

  const handleAction = (action: string, emoji?: string) => {
    setShowActionModal(false);
    if (!selectedMessage || !user) return;
    const actualConvId = id.toString().startsWith('new_') ? id.toString().split('_')[1] : id;

    if (action === 'edit') {
      setInput(selectedMessage.content);
      setEditingMessageId(selectedMessage.id);
    } else if (action === 'delete') {
      Alert.alert('Delete', 'Delete this message?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
            setMessages(prev => prev.map(m => m.id === selectedMessage.id ? { ...m, content: 'This message was deleted', is_deleted: true } : m));
            socketService.emit('delete_message', {
              message_id: selectedMessage.id,
              user_id: user.id,
              conversation_id: actualConvId
            });
        }}
      ]);
    } else if (action === 'react' && emoji) {
      setMessages(prev => prev.map(m => {
        if (m.id === selectedMessage.id) {
          let newReactions = { ...(m.reactions || {}) };
          let users = newReactions[emoji] || [];
          if (users.includes(user.id)) {
            users = users.filter((u: string) => u !== user.id);
            if (users.length === 0) delete newReactions[emoji];
            else newReactions[emoji] = users;
          } else {
            newReactions[emoji] = [...users, user.id];
          }
          return { ...m, reactions: newReactions };
        }
        return m;
      }));
      socketService.emit('react_message', {
        message_id: selectedMessage.id,
        user_id: user.id,
        emoji,
        conversation_id: actualConvId
      });
    }
  };

  // Escrow Handler operations
  const handleInitiateEscrow = async () => {
    if (!conversation || !user) return;
    const isSkillToCash = conversation.service_type === 'SKILL_TO_CASH';
    const price = conversation.service_price;
    const currency = conversation.currency || 'XAF';
    const confirmMsg = isSkillToCash
      ? `You are about to lock ${price} ${currency} into escrow for "${conversation.service_title}". This amount will be held until the service is delivered and you confirm it.`
      : `Both parties will have their hold amount locked. The exchange will complete once both confirm.`;
    Alert.alert(
      isSkillToCash ? 'Confirm Purchase 💳' : 'Initiate Exchange',
      confirmMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSkillToCash ? 'Buy & Lock Funds' : 'Initiate',
          style: 'default',
          onPress: async () => {
            try {
              setLoadingEscrow(true);
              const counterparty = user.id === conversation.user1_id ? conversation.user2_id : conversation.user1_id;
              await api.initiateEscrow(conversation.service_id, counterparty, conversation.id);
              Alert.alert(
                isSkillToCash ? '🔒 Purchase Requested' : '🔒 Exchange Initiated',
                isSkillToCash
                  ? 'The service provider will now confirm your request. Your funds will be locked on acceptance.'
                  : 'Waiting for the other party to accept and lock their hold amount.'
              );
              loadConversationAndEscrow();
              fetchMessages();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to initiate transaction');
            } finally {
              setLoadingEscrow(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptEscrow = async () => {
    if (!escrow) return;
    try {
      setLoadingEscrow(true);
      await api.acceptEscrow(escrow.id);
      // Escrow is now instantly locked via wallet-to-wallet — no webhook simulation needed
      Alert.alert(
        '🔒 Order Accepted!',
        'Funds have been instantly locked from the buyer\'s wallet into escrow. You can now begin work on the service.'
      );
      loadConversationAndEscrow();
      fetchMessages();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept transaction');
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
      const res = await api.confirmEscrow(escrow.id);

      if (res?.status === 'PARTIAL_CONFIRM') {
        // S2S two-way handshake: this user confirmed, waiting for the other
        setMyConfirmedExchange(true);
        Alert.alert('✅ Confirmed!', 'Your confirmation recorded. Waiting for the other party to confirm. Holds will be released once both confirm.');
        loadConversationAndEscrow();
        fetchMessages();
        return;
      }

      // Fully completed
      Alert.alert('✅ Completed!', 'Transaction complete. Funds have been released.');
      setMyConfirmedExchange(false);
      loadConversationAndEscrow();
      fetchMessages();

      // Trigger rating modal
      const revieweeId = user.id === escrow.initiator_id ? escrow.counterparty_id : escrow.initiator_id;
      const revieweeName = user.id === conversation.user1_id ? conversation.user2_name : conversation.user1_name;
      setRatingRevieweeId(revieweeId);
      setRatingRevieweeName(revieweeName);
      setRatingScore(5);
      setRatingComment('');
      setRatingModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to confirm transaction');
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

    const serviceType = conversation?.service_type;
    const isProvider = (user?.id === conversation?.service_owner_id);
    const isBuyer = !isProvider;
    const currency = conversation?.currency || 'XAF';

    // ─── NO ACTIVE ESCROW ───────────────────────────────────────────────────────
    if (!escrow) {
      if (serviceType === 'SKILL_TO_CASH') {
        // Only the buyer (non-provider) can initiate a purchase
        if (isBuyer) {
          return (
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#007AFF', paddingHorizontal: 14 }]}
              onPress={handleInitiateEscrow}
            >
              <Typography variant="body2" color="white" weight="bold">BUY SERVICE 💳</Typography>
            </TouchableOpacity>
          );
        } else {
          // Provider cannot initiate — they wait for a buyer
          return (
            <Typography variant="caption" color={colors.black3} style={styles.escrowStatusText}>
              Awaiting buyer...
            </Typography>
          );
        }
      }
      // SKILL_TO_SKILL — either party can initiate
      return (
        <TouchableOpacity style={[styles.escrowActionBtn, { backgroundColor: colors.primary }]} onPress={handleInitiateEscrow}>
          <Typography variant="body2" color="white" weight="bold">INITIATE EXCHANGE 🔄</Typography>
        </TouchableOpacity>
      );
    }

    const isClient = !isProvider;

    // ─── AWAITING COUNTERPARTY ──────────────────────────────────────────────────
    if (escrow.status === 'AWAITING_COUNTERPARTY') {
      const isCounterparty = (user?.id === escrow.counterparty_id);
      if (isCounterparty) {
        // For SKILL_TO_CASH: provider accepts the buyer's request
        const acceptLabel = serviceType === 'SKILL_TO_CASH' ? 'ACCEPT ORDER' : 'ACCEPT';
        return (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#34C759', marginRight: 8 }]}
              onPress={handleAcceptEscrow}
            >
              <Typography variant="caption" color="white" weight="bold">{acceptLabel} ✅</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#FF3B30' }]}
              onPress={() => Alert.alert('Decline Request', 'Are you sure you want to decline this request?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Decline', style: 'destructive', onPress: () => Alert.alert('Declined', 'Request declined.') }
              ])}
            >
              <Typography variant="caption" color="white" weight="bold">DECLINE ✗</Typography>
            </TouchableOpacity>
          </View>
        );
      } else {
        const waitMsg = serviceType === 'SKILL_TO_CASH'
          ? 'Waiting for provider to accept...'
          : 'Waiting for counterparty...';
        return (
          <Typography variant="caption" color={colors.black3} style={styles.escrowStatusText}>
            {waitMsg}
          </Typography>
        );
      }
    }

    // ─── BOTH LOCKED ────────────────────────────────────────────────────────────
    if (escrow.status === 'BOTH_LOCKED') {
      if (serviceType === 'SKILL_TO_CASH') {
        if (isProvider) {
          return (
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#FF9500' }]}
              onPress={() =>
                Alert.alert('Mark as Delivered?', 'Confirm that you have completed the service. The buyer will then have 48h to confirm or dispute.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Yes, Mark Delivered', onPress: handleMarkDelivered },
                ])
              }
            >
              <Typography variant="body2" color="white" weight="bold">MARK DELIVERED 📦</Typography>
            </TouchableOpacity>
          );
        } else {
          // Buyer: funds are locked, waiting for provider to complete
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Typography variant="body2" color="#34C759" weight="bold" style={styles.escrowStatusText}>
                💰 Funds Locked
              </Typography>
            </View>
          );
        }
      }
      // SKILL_TO_SKILL in BOTH_LOCKED — both sides locked, either can confirm
      // If this user already confirmed, show waiting state
      if (myConfirmedExchange) {
        return (
          <Typography variant="caption" color="#FF9500" weight="bold" style={styles.escrowStatusText}>
            ✅ You confirmed — waiting for other party...
          </Typography>
        );
      }
      return (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={[styles.escrowActionBtn, { backgroundColor: '#34C759', marginRight: 8 }]}
            onPress={() =>
              Alert.alert('Confirm Exchange?', 'Confirming means you are satisfied with the exchange. Both parties must confirm for holds to be released.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm ✅', onPress: handleConfirmEscrow },
              ])
            }
          >
            <Typography variant="caption" color="white" weight="bold">CONFIRM EXCHANGE ✅</Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.escrowActionBtn, { backgroundColor: '#FF3B30' }]}
            onPress={handleDispute}
          >
            <Typography variant="caption" color="white" weight="bold">DISPUTE ⚠️</Typography>
          </TouchableOpacity>
        </View>
      );
    }

    // ─── PROVIDER MARKED DONE ───────────────────────────────────────────────────
    if (escrow.status === 'PROVIDER_MARKED_DONE') {
      if (isClient) {
        return (
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#34C759', marginRight: 8 }]}
              onPress={() =>
                Alert.alert('Confirm Service Delivery?', 'By confirming, funds will be released to the provider. Only do this if you are satisfied with the service.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Yes, Release Funds ✅', onPress: handleConfirmEscrow },
                ])
              }
            >
              <Typography variant="caption" color="white" weight="bold">CONFIRM ✅</Typography>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.escrowActionBtn, { backgroundColor: '#FF3B30' }]}
              onPress={handleDispute}
            >
              <Typography variant="caption" color="white" weight="bold">DISPUTE ⚠️</Typography>
            </TouchableOpacity>
          </View>
        );
      } else {
        return (
          <Typography variant="caption" color="#FF9500" weight="bold" style={styles.escrowStatusText}>
            Delivered — Awaiting confirmation
          </Typography>
        );
      }
    }

    // ─── DISPUTED ───────────────────────────────────────────────────────────────
    if (escrow.status === 'DISPUTED' || escrow.status === 'DISPUTE_NO_PROOF') {
      return (
        <Typography variant="caption" color="#FF3B30" weight="bold" style={styles.escrowStatusText}>
          ⚠️ In dispute — Admin reviewing
        </Typography>
      );
    }

    // ─── COMPLETED / CANCELLED / FORFEITED ─────────────────────────────────────
    if (escrow.status === 'COMPLETED') {
      return (
        <Typography variant="caption" color="#34C759" weight="bold" style={styles.escrowStatusText}>
          ✅ Transaction Complete
        </Typography>
      );
    }
    if (escrow.status === 'CANCELLED' || escrow.status === 'REFUNDED' || escrow.status === 'FORFEITED') {
      return (
        <Typography variant="caption" color={colors.black3} weight="bold" style={styles.escrowStatusText}>
          Transaction {escrow.status.toLowerCase()}
        </Typography>
      );
    }

    // Generic fallback
    return (
      <Typography variant="caption" color={colors.primary} weight="bold" style={styles.escrowStatusText}>
        Status: {escrow.status}
      </Typography>
    );
  };

  const uploadAndSend = async (uri: string, name: string, mimeType: string, prefix: string) => {
    if (!user) return;
    setUploadingMedia(true);
    try {
      const uploadRes = await api.uploadFiles([{ uri, name, mimeType }]);
      const serverUrl = uploadRes.urls[0];
      
      const isNew = id.toString().startsWith('new_');
      const actualConvId = isNew ? id.toString().split('_')[1] : id;
      
      const content = prefix === '[FILE]' ? `${prefix}${name}|${serverUrl}` : `${prefix}${serverUrl}`;
      
      const messageData = {
        conversation_id: actualConvId as string,
        sender_id: user.id,
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
      <Swipeable
        renderLeftActions={() => (
          <View style={{ justifyContent: 'center', alignItems: 'center', width: 60 }}>
            <Typography variant="h6">↩️</Typography>
          </View>
        )}
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            setReplyingToMessage(item);
          }
        }}
      >
        <TouchableOpacity 
          activeOpacity={0.8}
          delayLongPress={300}
          style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft, isSystem && { alignSelf: 'center', maxWidth: '90%' }]}
          onLongPress={() => {
            setSelectedMessage(item);
            setShowActionModal(true);
          }}
        >
          <View style={[styles.bubbleContainer, isMe ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }]}>
            {!isSystem && <Image source={{ uri: item.sender?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp' }} style={styles.bubbleAvatar} />}
            <View style={[
              styles.msgBubble, 
              isImage && { paddingHorizontal: 4, paddingVertical: 4, backgroundColor: 'transparent' },
              isSystem ? [styles.systemBubble, { backgroundColor: colors.primary + '15', borderColor: colors.primary }] :
              (!isImage && isMe) ? [styles.bubbleRight, { backgroundColor: '#007AFF' }] : 
              (!isImage && !isMe) ? [styles.bubbleLeft, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#E5E5EA' }] : {}
            ]}>
              {/* Replied Message Snippet */}
              {item.reply_to_message && !isSystem && (
                <View style={{backgroundColor: 'rgba(0,0,0,0.15)', padding: 6, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: isMe ? '#FFF' : colors.primary}}>
                  <Typography variant="caption" color={isMe ? '#FFF' : colors.black2} numberOfLines={1}>
                    {item.reply_to_message.content}
                  </Typography>
                </View>
              )}

              {item.is_deleted ? (
                <Typography variant="body1" color={isMe ? 'rgba(255,255,255,0.7)' : colors.black3} style={{fontStyle: 'italic'}}>
                  🚫 This message was deleted
                </Typography>
              ) : isImage ? (
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
              
              {/* Reactions */}
              {item.reactions && Object.keys(item.reactions).length > 0 && !isSystem && !item.is_deleted && (
                <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginLeft: -4}}>
                  {Object.entries(item.reactions).map(([emoji, users]) => (
                    <View key={emoji} style={{backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, margin: 2}}>
                      <Typography variant="caption" color="#000">{emoji} {(users as string[]).length}</Typography>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isSystem ? 'center' : isMe ? 'flex-end' : 'flex-start', marginTop: 4, marginLeft: isMe || isSystem ? 0 : 44, marginRight: isMe && !isSystem ? 44 : 0 }}>
            <Typography variant="caption" color={colors.black3} style={{ marginRight: isMe ? 4 : 0 }}>
              {formatTime(item.created_at)}
            </Typography>
            {item.is_edited && !item.is_deleted && (
              <Typography variant="caption" color={colors.black3} style={{ marginRight: 4, fontStyle: 'italic' }}>
                (edited)
              </Typography>
            )}
            {isMe && !isSystem && (
              <Typography variant="caption" color={item.status === 'read' ? '#007AFF' : colors.black3}>
                {item.status === 'read' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}
              </Typography>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
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
          <Typography variant="caption" color={isOnline ? '#34C759' : colors.black3} style={{ textAlign: 'center' }}>
            {isOnline ? 'Online' : 'Offline'}
          </Typography>
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
      
      {/* Conversation timeline messages */}
      <Animated.FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      />

      {/* Escrow Status Bar */}
      {conversation && conversation.service_id && (
        <View style={[styles.escrowBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.escrowTextCol}>
            <Typography variant="body2" weight="bold" numberOfLines={1}>
              {conversation.service_title}
            </Typography>
            {conversation.service_type === 'SKILL_TO_CASH' ? (
              <Typography variant="caption" color={colors.black3}>
                Price: {conversation.service_price} {conversation.currency || 'XAF'}
              </Typography>
            ) : (
              <Typography variant="caption" color={colors.black3}>
                Hold: {conversation.holdup_amount} {conversation.currency || 'XAF'} each
              </Typography>
            )}
          </View>
          {renderEscrowActions()}
        </View>
      )}

      {/* Reply / Edit Preview Bar */}
      {(replyingToMessage || editingMessageId) && (
        <View style={{ backgroundColor: colors.card, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8 }}>
            <Typography variant="caption" color={colors.primary} weight="bold">
              {editingMessageId ? 'Editing Message' : `Replying to ${replyingToMessage?.sender?.display_name || 'Message'}`}
            </Typography>
            <Typography variant="body2" color={colors.black2} numberOfLines={1}>
              {editingMessageId ? input : replyingToMessage?.content}
            </Typography>
          </View>
          <TouchableOpacity onPress={() => { setReplyingToMessage(null); setEditingMessageId(null); if (editingMessageId) setInput(''); }}>
            <Typography variant="h5" color={colors.black3}>✕</Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* iOS Style Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.attachBtn, {marginBottom:Platform.OS === 'ios' ? 0 : 40}]} onPress={() => setShowAttachModal(true)} disabled={uploadingMedia}>
          {uploadingMedia ? (
            <ActivityIndicator size="small" color={colors.black3} />
          ) : (
            <Typography variant="h4" color={colors.black3}>+</Typography>
          )}
        </TouchableOpacity>
        
        <View style={[styles.inputWrapper, { backgroundColor: theme === 'dark' ? '#1C1C1E' : '#FFFFFF', borderColor: colors.border,marginBottom:Platform.OS === 'ios' ? 0 : 40}]}>
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
          style={[styles.sendBtn, { backgroundColor: input.trim() ? '#007AFF' : 'transparent',marginBottom:Platform.OS === 'ios' ? 0 : 40 }]} 
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Image source={icons.send} style={[styles.sendIcon, { tintColor: input.trim() ? '#FFF' : colors.black3 }]} />
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

      {/* Message Action Modal */}
      <Modal transparent visible={showActionModal} animationType="fade">
        <TouchableWithoutFeedback onPress={() => { setShowActionModal(false); setCustomEmoji(''); }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
              <View style={styles.actionSheetHandle} />
              
              {/* Reactions Row */}
              {!selectedMessage?.is_deleted && !selectedMessage?.content?.startsWith('🤝') && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  {['👍', '❤️', '😂', '😮', '😢'].map(emoji => (
                    <TouchableOpacity key={emoji} onPress={() => handleAction('react', emoji)}>
                      <Typography variant="h2">{emoji}</Typography>
                    </TouchableOpacity>
                  ))}
                  
                  {/* Keyboard Emoji Picker Input */}
                  <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                     <TextInput 
                       style={{ fontSize: 32, padding: 0, margin: 0, textAlign: 'center', minWidth: 40 }}
                       placeholder="+"
                       placeholderTextColor={colors.black3}
                       onChangeText={(text) => {
                         if (text) {
                           handleAction('react', text);
                         }
                       }}
                       value={customEmoji}
                       maxLength={2}
                     />
                  </View>
                </View>
              )}

              {/* Actions */}
              {selectedMessage?.sender_id === user?.id && !selectedMessage?.is_deleted && (
                <>
                  <TouchableOpacity style={styles.actionSheetBtn} onPress={() => handleAction('edit')}>
                    <Typography variant="h5" style={{marginRight: 12}}>✏️</Typography>
                    <Typography variant="body1" color={colors.black1} style={{fontFamily: 'Rubik-Medium'}}>Edit Message</Typography>
                  </TouchableOpacity>
                  
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  
                  <TouchableOpacity style={styles.actionSheetBtn} onPress={() => handleAction('delete')}>
                    <Typography variant="h5" style={{marginRight: 12}}>🗑️</Typography>
                    <Typography variant="body1" color={colors.danger} style={{fontFamily: 'Rubik-Medium'}}>Delete Message</Typography>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
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

      {/* Settings drop down modal */}
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
              <View style={[styles.disputeInputGroup, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 16 }]}>
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
            <View style={[styles.disputeInputGroup, styles.textAreaGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
  disputeInputGroup: {
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
