import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../src/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/contexts/AppContext';

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export default function AdminDashboard() {
  const { colors } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ 
    commission_percentage: '5.0',
    pro_monthly_price: '5000',
    pro_yearly_price: '50000'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const styles = createStyles(colors);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Try to fetch both, ignore failure if backend is not deployed
      const [statsRes, settingsRes] = await Promise.all([
        api.request('/admin/stats').catch(() => null),
        api.getAdminSettings().catch(() => null)
      ]);
      
      if (statsRes?.stats) setStats(statsRes.stats);
      if (settingsRes?.settings) setSettings(settingsRes.settings);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      await api.updateAdminSettings({ 
        commission_percentage: parseFloat(settings.commission_percentage),
        pro_monthly_price: parseInt(settings.pro_monthly_price, 10),
        pro_yearly_price: parseInt(settings.pro_yearly_price, 10),
      });
      Alert.alert('Success', 'Platform settings updated successfully.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update settings. Is the backend deployed?');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* Platform Settings Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="settings-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Platform Settings</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.label}>Commission Percentage (%)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={String(settings.commission_percentage)}
              onChangeText={(text) => setSettings({ ...settings, commission_percentage: text })}
              keyboardType="numeric"
              placeholder="e.g. 5.0"
              placeholderTextColor={colors.gray}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.helpText}>This percentage is taken as a fee on successful payments.</Text>
        </View>

        <View style={[styles.card, { marginTop: spacing.md }]}>
          <Text style={styles.label}>Pro Monthly Price (XAF)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={String(settings.pro_monthly_price || '')}
              onChangeText={(text) => setSettings({ ...settings, pro_monthly_price: text })}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              placeholderTextColor={colors.gray}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.label, { marginTop: spacing.md }]}>Pro Yearly Price (XAF)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={String(settings.pro_yearly_price || '')}
              onChangeText={(text) => setSettings({ ...settings, pro_yearly_price: text })}
              keyboardType="numeric"
              placeholder="e.g. 50000"
              placeholderTextColor={colors.gray}
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Global Stats Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.primary} />
          <Text style={styles.sectionTitle}>Global Statistics</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="people-outline" title="Total Users" value={stats?.totalUsers || 0} color={colors.primary} />
          <StatCard icon="briefcase-outline" title="Services" value={stats?.totalServices || 0} color={colors.secondary} />
          <StatCard icon="star-outline" title="Pro Users" value={stats?.proUsers || 0} color="#F59E0B" />
          <StatCard icon="rocket-outline" title="Featured" value={stats?.featuredServices || 0} color="#8B5CF6" />
        </View>
      </View>

    </ScrollView>
  );
}

function StatCard({ icon, title, value, color }: { icon: any, title: string, value: number, color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  card: {
    backgroundColor: colors.card || '#ffffff',
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    backgroundColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.primary,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  saveButtonText: {
    color: colors.white || '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  helpText: {
    fontSize: 12,
    color: colors.text,
    opacity: 0.6,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statTitle: {
    ...typography.body2,
    color: colors.gray,
    marginTop: 4,
  },
});
