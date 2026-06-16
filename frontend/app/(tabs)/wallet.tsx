import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../src/contexts/AppContext';
import { api } from '../../src/services/api';
import { icons } from '../../src/constants';

export default function WalletScreen() {
  const { colors, user } = useApp();
  const [balance, setBalance] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const balanceRes = await api.getWalletBalance();
      setBalance(balanceRes);
      
      const historyRes = await api.getWalletHistory();
      setHistory(historyRes.history || []);
    } catch (error: any) {
      console.log('Error fetching wallet:', error);
      Alert.alert('Error', error.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!phone) {
      Alert.alert('Error', 'Please enter your Mobile Money number');
      return;
    }

    try {
      setProcessing(true);
      if (modalType === 'deposit') {
        await api.depositFunds(Number(amount), phone);
        Alert.alert('Success', 'Deposit successful (Sandbox)');
      } else {
        await api.withdrawFunds(Number(amount), phone);
        Alert.alert('Success', 'Withdrawal successful (Sandbox)');
      }
      
      setModalVisible(false);
      setAmount('');
      fetchWalletData();
    } catch (error: any) {
      Alert.alert('Transaction Failed', error.message || 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const openModal = (type: 'deposit' | 'withdraw') => {
    setModalType(type);
    setAmount('');
    setModalVisible(true);
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const isPositive = ['deposit', 'transfer_in', 'unlock', 'refund'].includes(item.type);
    const amountColor = isPositive ? '#10B981' : colors.danger;
    const sign = isPositive ? '+' : '-';

    // Format date
    const date = new Date(item.created_at);
    const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    return (
      <View style={[styles.historyItem, { borderBottomColor: colors.border }]}>
        <View style={styles.historyLeft}>
          <Text style={[styles.historyType, { color: colors.black1 }]}>{item.description}</Text>
          <Text style={[styles.historyDate, { color: colors.black2 }]}>{dateStr}</Text>
        </View>
        <View style={styles.historyRight}>
          <Text style={[styles.historyAmount, { color: amountColor }]}>
            {sign}{Number(item.amount).toLocaleString()} {user?.currency || balance?.currency || 'XAF'}
          </Text>
          {item.status === 'pending' && (
            <Text style={[styles.historyStatus, { color: colors.warning }]}>Pending</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && !balance) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.black1 }]}>My Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={[styles.card, { backgroundColor: colors.primary }]}>
        <Text style={styles.cardLabel}>Available Balance</Text>
        <Text style={styles.cardBalance}>
          {Number(balance?.balance || 0).toLocaleString()} {user?.currency || balance?.currency || 'XAF'}
        </Text>
        
        {Number(balance?.pending_balance) > 0 && (
          <View style={styles.pendingContainer}>
            <Text style={styles.pendingLabel}>Pending (Escrow):</Text>
            <Text style={styles.pendingAmount}>
              {Number(balance?.pending_balance).toLocaleString()} {user?.currency || balance?.currency || 'XAF'}
            </Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => openModal('deposit')}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primary + '20' }]}>
            <Image source={icons.wallet} style={[styles.icon, { tintColor: colors.primary }]} />
          </View>
          <Text style={[styles.actionText, { color: colors.black1 }]}>Deposit</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => openModal('withdraw')}
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.danger + '20' }]}>
             <Image source={icons.wallet} style={[styles.icon, { tintColor: colors.danger }]} />
          </View>
          <Text style={[styles.actionText, { color: colors.black1 }]}>Withdraw</Text>
        </TouchableOpacity>
      </View>

      {/* History */}
      <View style={styles.historyContainer}>
        <Text style={[styles.sectionTitle, { color: colors.black1 }]}>Recent Transactions</Text>
        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.black2 }]}>No transactions yet</Text>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            renderItem={renderHistoryItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onRefresh={fetchWalletData}
            refreshing={loading}
          />
        )}
      </View>

      {/* Deposit/Withdraw Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
              <Text style={[styles.modalTitle, { color: colors.black1 }]}>
                {modalType === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.black2 }]}>
                Via Mobile Money (Sandbox)
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.black1 }]}>Amount ({user?.currency || balance?.currency || 'XAF'})</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.inputBg || colors.border + '15' }]}>
                  <TextInput
                    style={[styles.input, { color: colors.black1 }]}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0"
                    placeholderTextColor={colors.black2}
                  />
                </View>
              </View>
   
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.black1 }]}>Mobile Money Number</Text>
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.inputBg || colors.border + '15' }]}>
                  <TextInput
                    style={[styles.input, { color: colors.black1 }]}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+237..."
                    placeholderTextColor={colors.black2}
                  />
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={() => setModalVisible(false)}
                  disabled={processing}
                >
                  <Text style={{ color: colors.black1, fontFamily: 'Rubik-Medium' }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleTransaction}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontFamily: 'Rubik-Medium' }}>
                      {modalType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Rubik-Bold',
  },
  card: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Rubik-Regular',
    fontSize: 16,
    marginBottom: 8,
  },
  cardBalance: {
    color: '#fff',
    fontFamily: 'Rubik-Bold',
    fontSize: 36,
  },
  pendingContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pendingLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Rubik-Medium',
  },
  pendingAmount: {
    color: '#fff',
    fontFamily: 'Rubik-SemiBold',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    width: 20,
    height: 20,
  },
  actionText: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 16,
  },
  historyContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Rubik-SemiBold',
    fontSize: 20,
    marginBottom: 16,
  },
  emptyText: {
    fontFamily: 'Rubik-Regular',
    textAlign: 'center',
    marginTop: 40,
  },
  listContent: {
    paddingBottom: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  historyLeft: {
    flex: 1,
    paddingRight: 16,
  },
  historyType: {
    fontFamily: 'Rubik-Medium',
    fontSize: 16,
    marginBottom: 4,
  },
  historyDate: {
    fontFamily: 'Rubik-Regular',
    fontSize: 12,
  },
  historyRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  historyAmount: {
    fontFamily: 'Rubik-Bold',
    fontSize: 16,
  },
  historyStatus: {
    fontFamily: 'Rubik-Medium',
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
  },
  modalTitle: {
    fontFamily: 'Rubik-Bold',
    fontSize: 24,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: 'Rubik-Regular',
    fontSize: 14,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: 'Rubik-Medium',
    fontSize: 14,
    marginBottom: 8,
  },
  inputContainer: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Rubik-Regular',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
});
