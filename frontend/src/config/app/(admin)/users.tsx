import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useApp } from '../../../contexts/AppContext';
import { api } from '../../../services/api';

export default function AdminUsers() {
  const { colors } = useApp();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    Alert.prompt(
      `Change status to ${newStatus}`,
      'Please provide a reason:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm', 
          onPress: async (reason?: string) => {
            if (!reason) return Alert.alert('Error', 'Reason is required');
            try {
              await api.setAdminUserStatus(userId, newStatus, reason);
              fetchUsers();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const renderUser = ({ item }: { item: any }) => (
    <View style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <View style={styles.colName}>
        <Text style={[styles.name, { color: colors.black1 }]}>{item.display_name}</Text>
        <Text style={[styles.phone, { color: colors.black2 }]}>{item.phone_number}</Text>
      </View>
      <View style={styles.colBal}>
        <Text style={{ color: colors.black1, fontFamily: 'Rubik-Medium' }}>
          {Number(item.balance || 0).toLocaleString()} XAF
        </Text>
        <Text style={{ color: colors.warning, fontSize: 12 }}>
          {Number(item.pending_balance || 0).toLocaleString()} pend.
        </Text>
      </View>
      <View style={styles.colStatus}>
        <Text style={{ 
          color: item.status === 'active' ? '#10b981' : '#ef4444', 
          fontFamily: 'Rubik-Medium' 
        }}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <View style={styles.colActions}>
        <TouchableOpacity 
          style={[styles.btn, { backgroundColor: item.status === 'active' ? '#ef4444' : '#10b981' }]}
          onPress={() => handleStatusChange(item.id, item.status)}
        >
          <Text style={styles.btnText}>{item.status === 'active' ? 'Suspend' : 'Activate'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Row */}
      <View style={[styles.headerRow, { backgroundColor: colors.border }]}>
        <Text style={[styles.colName, styles.headerText, { color: colors.black1 }]}>User</Text>
        <Text style={[styles.colBal, styles.headerText, { color: colors.black1 }]}>Wallet</Text>
        <Text style={[styles.colStatus, styles.headerText, { color: colors.black1 }]}>Status</Text>
        <Text style={[styles.colActions, styles.headerText, { color: colors.black1 }]}>Actions</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={i => i.id}
          renderItem={renderUser}
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
  
  colName: { flex: 3 },
  colBal: { flex: 2 },
  colStatus: { flex: 2 },
  colActions: { flex: 2, alignItems: 'flex-end' },

  name: { fontFamily: 'Rubik-SemiBold', fontSize: 16 },
  phone: { fontFamily: 'Rubik-Regular', fontSize: 12, marginTop: 2 },
  
  btn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  btnText: { color: '#fff', fontFamily: 'Rubik-Medium', fontSize: 12 }
});
