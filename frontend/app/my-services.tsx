import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { api, resolveImageUrl } from '../src/services/api';

export default function MyServicesScreen() {
  const router = useRouter();
  const { colors, user, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getUserServices(user.id);
      setServices(res.services || []);
    } catch (e) {
      console.error('Failed to fetch services:', e);
      Alert.alert('Error', 'Failed to retrieve your services.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (serviceId: string, title: string) => {
    const performDelete = async () => {
      try {
        setLoading(true);
        const res = await api.deleteService(serviceId);
        Alert.alert('Success', res.message || 'Service deleted successfully.');
        fetchServices();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to delete service.');
      } finally {
        setLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirm = window.confirm(`Are you sure you want to delete "${title}"?`);
      if (confirm) performDelete();
    } else {
      Alert.alert(
        'Delete Service',
        `Are you sure you want to delete "${title}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete }
        ]
      );
    }
  };

  const handleEdit = (serviceId: string) => {
    router.push(`/post-service?id=${serviceId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>&lt; Back</Typography>
        </TouchableOpacity>
        <Typography variant="h4">My Services</Typography>
        <View style={styles.placeholder} />
      </View>

      {loading && services.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={services}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardContent}>
                <Image source={{ uri: resolveImageUrl(item.images?.[0]) }} style={styles.serviceImage} />
                <View style={styles.textContainer}>
                  <Typography variant="h5" weight="bold" color={colors.black1} numberOfLines={1}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color={colors.black3} style={styles.categoryText}>
                    {item.category} • {item.service_type === 'SKILL_TO_CASH' ? 'Cash' : 'Skill Hold'}
                  </Typography>
                  <Typography variant="body2" color={colors.black2} numberOfLines={2} style={styles.description}>
                    {item.description}
                  </Typography>
                  
                  <View style={styles.priceRow}>
                    <Typography variant="h6" color={colors.primary} weight="bold">
                      {item.price_type === 'exchange' ? 'Barter' : `${item.price} ${item.currency}`}
                    </Typography>
                    {item.is_featured && (
                      <View style={[styles.countryBadge, { backgroundColor: '#8B5CF620' }]}>
                        <Typography variant="caption" color="#8B5CF6" weight="bold">⭐ Featured</Typography>
                      </View>
                    )}
                    {item.country && !item.is_featured && (
                      <View style={[styles.countryBadge, { backgroundColor: colors.border + '50' }]}>
                        <Typography variant="caption" color={colors.black2}>{item.country}</Typography>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, { borderColor: '#8B5CF6' }]}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      await api.boostService(item.id, 7);
                      Alert.alert('Success', 'Service boosted for 7 days!');
                      fetchServices();
                    } catch(e) {
                      Alert.alert('Error', 'Failed to boost service.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Typography variant="body2" color="#8B5CF6" weight="medium">🚀 Boost</Typography>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, { borderColor: colors.border }]}
                  onPress={() => handleEdit(item.id)}
                >
                  <Typography variant="body2" color={colors.primary} weight="medium">Update</Typography>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.actionBtn, styles.deleteBtn, { borderColor: colors.danger }]}
                  onPress={() => handleDelete(item.id, item.title)}
                >
                  <Typography variant="body2" color={colors.danger} weight="medium">Delete</Typography>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Typography variant="body1" color={colors.black3} style={{ marginBottom: 20 }}>
                You have not posted any services yet.
              </Typography>
              <Button title="Post a Service" onPress={() => router.push('/post-service')} />
            </View>
          }
          contentContainerStyle={{ paddingVertical: 16 }}
        />
      )}
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
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: 4,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  serviceImage: { width: 80, height: 80, borderRadius: 12, marginRight: 16 },
  textContainer: { flex: 1 },
  categoryText: { marginTop: 2, marginBottom: 4 },
  description: { fontSize: 13, marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  divider: { height: 1, marginVertical: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: { backgroundColor: 'transparent' },
  emptyContainer: { padding: 40, alignItems: 'center', justifyContent: 'center' },
});
