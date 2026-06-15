import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useApp } from '../../src/contexts/AppContext';
import { api } from '../../src/services/api';

export default function AdminTransactions() {
  const { colors } = useApp();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminTransactions();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isS4S = item.type === 'skill_for_skill';
    return (
      <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.colUsers}>
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.provider_name} ↔ {item.beneficiary_name}</Text>
        </View>
        <View style={styles.colType}>
          <Text style={{ color: colors.primary, fontSize: 12, fontFamily: 'Rubik-Medium' }}>
            {isS4S ? 'S4S' : 'C4S'}
          </Text>
          <Text style={{ color: colors.text, fontFamily: 'Rubik-SemiBold' }}>
            {Number(item.amount).toLocaleString()} XAF
          </Text>
        </View>
        <View style={styles.colStatus}>
          <Text style={{ 
            color: item.status === 'confirmed' ? '#10b981' : 
                   item.status === 'disputed' ? '#ef4444' : 
                   colors.warning, 
            fontFamily: 'Rubik-Medium' 
          }}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerRow, { backgroundColor: colors.border }]}>
        <Text style={[styles.colUsers, styles.headerText, { color: colors.text }]}>Service & Users</Text>
        <Text style={[styles.colType, styles.headerText, { color: colors.text }]}>Value / Type</Text>
        <Text style={[styles.colStatus, styles.headerText, { color: colors.text }]}>Status</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={i => i.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, alignItems: 'center' },
  headerRow: { flexDirection: 'row', padding: 12 },
  headerText: { fontFamily: 'Rubik-SemiBold', fontSize: 14 },
  
  colUsers: { flex: 4 },
  colType: { flex: 2 },
  colStatus: { flex: 2, alignItems: 'flex-end' },

  title: { fontFamily: 'Rubik-SemiBold', fontSize: 14, marginBottom: 4 },
});
