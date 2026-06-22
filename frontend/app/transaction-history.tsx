import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, TextInput, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { icons } from '../src/constants';
import { api, resolveImageUrl } from '../src/services/api';

export default function TransactionHistoryScreen() {
  const router = useRouter();
  const { colors, user, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedEscrows, setExpandedEscrows] = useState<Record<string, boolean>>({});

  // Rating Modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingEscrowId, setRatingEscrowId] = useState('');
  const [ratingRevieweeId, setRatingRevieweeId] = useState('');
  const [ratingRevieweeName, setRatingRevieweeName] = useState('');
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeFilter]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // Fetch summary statistics
      const sumRes = await api.getTransactionSummary();
      setSummary(sumRes);

      // Fetch history with type filter
      const historyRes = await api.getTransactionHistory(1, 40, activeFilter);
      setTransactions(historyRes.transactions || []);
    } catch (e) {
      console.error('Failed to fetch transaction data:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (txId: string) => {
    setExpandedEscrows(prev => ({
      ...prev,
      [txId]: !prev[txId]
    }));
  };

  const handleOpenRating = (escrowId: string, revieweeId: string, name: string) => {
    setRatingEscrowId(escrowId);
    setRatingRevieweeId(revieweeId);
    setRatingRevieweeName(name);
    setRatingScore(5);
    setRatingComment('');
    setRatingModalVisible(true);
  };

  const handleSubmitRating = async () => {
    try {
      setSubmittingRating(true);
      await api.submitRating(ratingEscrowId, ratingRevieweeId, ratingScore, ratingComment);
      Alert.alert("Success", "Thank you! Your rating has been recorded.");
      setRatingModalVisible(false);
      fetchData(); // Reload list to clear Rate Now button
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleSkipRating = async () => {
    // Skipping is client side only, close modal and leave ratingPending = true
    setRatingModalVisible(false);
  };

  const getTxIcon = (type: string) => {
    let iconSource;
    let tintColor = colors.primary;
    switch (type) {
      case 'DEPOSIT': iconSource = icons.wallet; break;
      case 'PAYOUT': iconSource = icons.send; tintColor = colors.danger; break;
      case 'REFUND': iconSource = icons.backArrow; break;
      case 'FEE': iconSource = icons.wallet; tintColor = colors.black2; break;
      case 'ARBITRATION': iconSource = icons.shield; tintColor = colors.danger; break;
      default: iconSource = icons.wallet; break;
    }
    return <Image source={iconSource} style={{ width: 28, height: 28, tintColor }} />;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return colors.primary;
      case 'PENDING': return '#F59E0B';
      case 'FAILED': return colors.danger;
      case 'DISPUTED': return colors.danger;
      case 'FORFEITED': return '#6B7280';
      default: return colors.black2;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const filters = [
    { label: t('all_caps'), value: 'ALL' },
    { label: t('deposits_caps'), value: 'DEPOSIT' },
    { label: t('payouts_caps'), value: 'PAYOUT' },
    { label: t('refunds_caps'), value: 'REFUND' }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>&lt; {t('close')}</Typography>
        </TouchableOpacity>
        <Typography variant="h4">{t('recent_transactions')}</Typography>
        <View style={styles.placeholder} />
      </View>

      {/* Summary Stats */}
      {!loading && summary && (
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCol}>
                <Typography variant="caption" color={colors.black3}>{t('total_earned')}</Typography>
                <Typography variant="h4" color={colors.primary}>{summary.totalEarned} {summary.currency}</Typography>
              </View>
              <View style={styles.summaryCol}>
                <Typography variant="caption" color={colors.black3}>{t('total_spent')}</Typography>
                <Typography variant="h4" color={colors.danger}>{summary.totalSpent} {summary.currency}</Typography>
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <View style={styles.statCol}>
                <Typography variant="h5">{summary.activeEscrows}</Typography>
                <Typography variant="caption" color={colors.black3}>{t('active_escrows')}</Typography>
              </View>
              <View style={styles.statCol}>
                <Typography variant="h5">{summary.completedDeals}</Typography>
                <Typography variant="caption" color={colors.black3}>{t('deals_done')}</Typography>
              </View>
              <View style={styles.statCol}>
                <Typography variant="h5">{summary.disputes}</Typography>
                <Typography variant="caption" color={colors.black3}>{t('disputes')}</Typography>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.value}
              style={[
                styles.filterTab,
                { backgroundColor: activeFilter === f.value ? colors.primary : colors.card, borderColor: colors.border }
              ]}
              onPress={() => setActiveFilter(f.value)}
            >
              <Typography variant="body2" color={activeFilter === f.value ? 'white' : colors.black1}>{f.label}</Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Transaction List */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={item => item.transactionId}
          renderItem={({ item }) => {
            const isExpanded = !!expandedEscrows[item.transactionId];
            return (
              <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.txHeader}>
                  <View style={styles.txIcon}>{getTxIcon(item.type)}</View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Typography variant="h6" weight="bold">
                      {t(`tx_type_${item.type.toLowerCase()}`) || item.type} {item.escrow ? `(${item.escrow.type === 'SKILL_TO_CASH' ? t('cash_for_skill') : t('skill_for_skill')})` : ''}
                    </Typography>
                    <Typography variant="caption" color={colors.black3}>{formatTime(item.createdAt)}</Typography>
                  </View>
                  <Typography variant="h5" color={item.type === 'DEPOSIT' || item.type === 'REFUND' ? colors.primary : colors.black1}>
                    {item.type === 'DEPOSIT' ? '+' : '-'}{item.amount} {item.currency}
                  </Typography>
                </View>

                {item.service && (
                  <View style={styles.txDetailRow}>
                    <Typography variant="body2" color={colors.black2}>
                      Service: <Typography weight="bold">{item.service.title}</Typography>
                    </Typography>
                  </View>
                )}

                {item.counterparty && (
                  <View style={styles.counterpartyRow}>
                    <Image source={{ uri: resolveImageUrl(item.counterparty.avatar) }} style={styles.avatar} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Typography variant="body2" weight="bold">{item.counterparty.name}</Typography>
                      <Typography variant="caption" color={colors.black3}>
                        Rating: {item.counterparty.averageRating > 0 ? `${item.counterparty.averageRating}★` : 'No reviews'}
                      </Typography>
                    </View>
                  </View>
                )}

                {item.pawapayRef && (
                  <Typography variant="caption" color={colors.black3} style={styles.refText}>
                    {t('ref_id')} {item.pawapayRef}
                  </Typography>
                )}

                {item.platformFee > 0 && (
                  <Typography variant="caption" color={colors.primary} style={styles.feeText}>
                    {t('platform_fee')} {item.platformFee} {item.currency}
                  </Typography>
                )}

                <View style={styles.txFooter}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '15' }]}>
                    <Typography variant="caption" color={getStatusColor(item.status)} weight="bold">{t(`status_${item.status.toLowerCase()}`) || item.status}</Typography>
                  </View>

                  <View style={{ flexDirection: 'row' }}>
                    {item.ratingPending && item.escrow?.status === 'COMPLETED' && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.primary, marginRight: 8 }]}
                        onPress={() => handleOpenRating(item.escrow.id, item.counterparty?.id, item.counterparty?.name)}
                      >
                        <Typography variant="caption" color="white" weight="bold">{t('rate_now')}</Typography>
                      </TouchableOpacity>
                    )}

                    {item.escrow && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => toggleExpand(item.transactionId)}
                      >
                        <Typography variant="caption" color={colors.primary} weight="bold">
                          {isExpanded ? t('hide_details') : t('view_timeline')}
                        </Typography>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Expanded Timeline details */}
                {isExpanded && item.escrow && (
                  <View style={[styles.timelineContainer, { borderTopColor: colors.border }]}>
                    <Typography variant="body2" weight="bold" style={{ marginBottom: 12 }}>{t('view_timeline')}</Typography>
                    {item.escrow.timeline.filter((ev: any) => ev.at).map((ev: any, idx: number) => (
                      <View key={idx} style={styles.timelineRow}>
                        <View style={styles.timelineIndicator}>
                          <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                          {idx < item.escrow.timeline.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <Typography variant="body2" weight="bold">{ev.event}</Typography>
                          <Typography variant="caption" color={colors.black3}>{formatTime(ev.at)}</Typography>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Typography variant="body1" color={colors.black3}>{t('no_transactions')}</Typography>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {/* Ratings Modal */}
      <Modal visible={ratingModalVisible} transparent animationType="slide" onRequestClose={handleSkipRating}>
        <Pressable style={styles.modalOverlay} onPress={handleSkipRating}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Typography variant="h4" style={{ marginBottom: 12 }}>{t('rate_user', { name: ratingRevieweeName })}</Typography>
            <Typography variant="body2" color={colors.black2} style={{ marginBottom: 20 }}>
              {t('rate_desc')}
            </Typography>

            {/* Stars selection */}
            <View style={styles.starContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRatingScore(star)}>
                  <Typography variant="h1" style={[styles.starIcon, { color: star <= ratingScore ? '#FFB800' : colors.border }]}>
                    ★
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>

            {/* Comment field */}
            <Typography variant="body2" weight="bold" style={{ marginBottom: 8, marginTop: 16 }}>{t('comments_optional')}</Typography>
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

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]} 
                onPress={handleSkipRating}
              >
                <Typography variant="body2" color={colors.black2}>{t('skip')}</Typography>
              </TouchableOpacity>
              <Button 
                title={t('submit')} 
                onPress={handleSubmitRating} 
                loading={submittingRating}
                style={{ flex: 1, marginLeft: 12 }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 4,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { width: 80 },
  placeholder: { width: 80 },
  summaryContainer: { padding: 4 },
  summaryCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  summaryCol: { alignItems: 'center' },
  statCol: { alignItems: 'center' },
  divider: { height: 1, marginVertical: 12 },
  filterBar: { paddingHorizontal: 4, marginBottom: 16 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  txCard: {
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  txHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  txIcon: { fontSize: 24 },
  txDetailRow: { marginBottom: 8 },
  counterpartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: 8,
    borderRadius: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  refText: { fontSize: 11, marginBottom: 4 },
  feeText: { fontSize: 11, marginBottom: 8, fontWeight: 'bold' },
  txFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  timelineRow: { flexDirection: 'row', minHeight: 48 },
  timelineIndicator: { alignItems: 'center', width: 24 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineLine: { flex: 1, width: 2, marginVertical: 4 },
  timelineContent: { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 4,
  },
  starContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  starIcon: { fontSize: 40 },
  inputGroup: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textAreaGroup: { height: 80, alignItems: 'flex-start', paddingTop: 8, marginBottom: 20 },
  input: { flex: 1, fontSize: 16, fontFamily: 'Rubik-Regular' },
  textArea: { textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', marginTop: 12 },
  modalBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
