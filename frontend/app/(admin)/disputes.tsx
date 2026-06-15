import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useApp } from '../../src/contexts/AppContext';
import { api } from '../../src/services/api';

export default function AdminDisputes() {
  const { colors } = useApp();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminDisputes();
      setDisputes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = (id: string, resolution: string) => {
    Alert.prompt(
      'Resolve Dispute',
      \`Confirm resolving as "\${resolution}". Provide a reason:\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async (reason) => {
            if (!reason) return Alert.alert('Error', 'Reason is required');
            try {
              await api.resolveAdminDispute(id, resolution, reason);
              fetchData();
              Alert.alert('Success', 'Dispute resolved.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.status, { 
          color: item.status === 'resolved' ? '#10b981' : '#ef4444' 
        }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      
      <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Amount: {Number(item.amount).toLocaleString()} XAF</Text>
      <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Reason: {item.dispute_reason || 'No reason provided'}</Text>
      
      {item.status === 'disputed' && (
        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#10b981' }]}
            onPress={() => handleResolve(item.id, 'provider_wins')}
          >
            <Text style={styles.btnText}>Provider Wins</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#3b82f6' }]}
            onPress={() => handleResolve(item.id, 'split')}
          >
            <Text style={styles.btnText}>Split (50/50)</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#ef4444' }]}
            onPress={() => handleResolve(item.id, 'beneficiary_wins')}
          >
            <Text style={styles.btnText}>Beneficiary Wins</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.status === 'resolved' && (
        <Text style={{ color: colors.primary, fontFamily: 'Rubik-Medium' }}>
          Resolved: {item.dispute_resolution}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontFamily: 'Rubik-SemiBold', fontSize: 16, flex: 1 },
  status: { fontFamily: 'Rubik-Bold', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, flexGrow: 1, alignItems: 'center' },
  btnText: { color: '#fff', fontFamily: 'Rubik-Medium', fontSize: 12 }
});
