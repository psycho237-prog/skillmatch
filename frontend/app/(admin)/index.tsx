import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { useApp } from '../../src/contexts/AppContext';
import { api } from '../../src/services/api';

export default function AdminDashboard() {
  const { colors } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    // Auto refresh every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.getAdminStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderCard = (title: string, value: string | number, subtitle?: string, color: string = colors.primary) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Text style={[styles.cardTitle, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text>
      {subtitle && <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Global Overview</Text>

      {/* Users Section */}
      <Text style={[styles.groupTitle, { color: colors.text }]}>Users</Text>
      <View style={styles.grid}>
        {renderCard('Total Users', stats?.users?.total, 'Registered', '#0ea5e9')}
        {renderCard('New Today', stats?.users?.new_today, 'Last 24h', '#10b981')}
        {renderCard('Active (Month)', stats?.users?.active_this_month, 'Transacted', '#f59e0b')}
        {renderCard('Suspended', stats?.users?.suspended, 'Blocked', '#ef4444')}
      </View>

      {/* Transactions Section */}
      <Text style={[styles.groupTitle, { color: colors.text }]}>Transactions</Text>
      <View style={styles.grid}>
        {renderCard('Total Tx', stats?.transactions?.total, 'All time', '#6366f1')}
        {renderCard('Pending', stats?.transactions?.pending, 'In progress', '#f59e0b')}
        {renderCard('Completed', stats?.transactions?.completed, 'Finished', '#10b981')}
        {renderCard('Disputed', stats?.transactions?.disputed, 'Requires action', '#ef4444')}
      </View>

      {/* Commissions Section */}
      <Text style={[styles.groupTitle, { color: colors.text }]}>Commissions & Revenue</Text>
      <View style={styles.grid}>
        {renderCard('Total Revenue', `${stats?.commissions?.total?.toLocaleString()} XAF`, 'All time', '#14b8a6')}
        {renderCard('Today', `${stats?.commissions?.today?.toLocaleString()} XAF`, 'Last 24h', '#14b8a6')}
        {renderCard('This Month', `${stats?.commissions?.month?.toLocaleString()} XAF`, 'Last 30 days', '#14b8a6')}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 24, fontFamily: 'Rubik-Bold', marginBottom: 20 },
  groupTitle: { fontSize: 18, fontFamily: 'Rubik-SemiBold', marginTop: 10, marginBottom: 10 },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    marginBottom: 20
  },
  card: {
    width: Dimensions.get('window').width > 600 ? '23%' : '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 12, fontFamily: 'Rubik-Medium', textTransform: 'uppercase', marginBottom: 8 },
  cardValue: { fontSize: 24, fontFamily: 'Rubik-Bold', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, fontFamily: 'Rubik-Regular' }
});
