import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Share, Linking, Modal, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, resolveImageUrl } from '../../src/services/api';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { icons } from '../../src/constants';
import { socketService } from '../../src/services/socket';
import { backupDbToCloud, restoreDbFromCloud } from '../../src/services/localDb';

export default function Profile() {
  const { colors, t, user, setUser, themePreference, setThemePreference, language, setLanguage, notificationsEnabled, setNotificationsEnabled } = useApp();
  const router = useRouter();
  
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [requirementsModalVisible, setRequirementsModalVisible] = useState(false);
  const [readinessData, setReadinessData] = useState<any>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);
  const [chatSettingsVisible, setChatSettingsVisible] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const fetchReadiness = async () => {
    if (!user) return;
    try {
      setLoadingReadiness(true);
      const res = await api.getUserReadiness(user.id);
      setReadinessData(res.readiness);
    } catch (e) {
      console.error('Failed to fetch readiness', e);
    } finally {
      setLoadingReadiness(false);
    }
  };

  const pickImage = async () => {
    router.push('/edit-profile');
  };

  const handleLogout = async () => {
    await setUser(null);
    router.replace('/(auth)/welcome');
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: 'Join me on Swapster! ' + 'https://swapster.greenfarmers.works',
        url: 'https://swapster.greenfarmers.works', // iOS
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleHelp = () => {
    Linking.openURL('https://swapster.greenfarmers.works/help');
  };

  const getThemeText = () => {
    if (themePreference === 'system') return t('theme_system');
    if (themePreference === 'dark') return t('theme_dark');
    return t('theme_light');
  };

  const getLangText = () => {
    const langs: Record<string, string> = {
      en: t('english'),
      fr: t('french'),
      de: t('german'),
      zh: t('chinese'),
      es: t('spanish'),
      ru: t('russian')
    };
    return langs[language] || t('english');
  };

  const menuItems: any[] = [
    { icon: icons.calendar, title: t('my_services'), action: () => router.push('/my-services') },
    { icon: icons.star, title: 'Post a Service', action: () => router.push('/post-service') },
    { icon: icons.wallet, title: 'Payments', action: () => router.push('/(tabs)/wallet') },
    { icon: icons.wallet, title: 'Transaction History', action: () => router.push('/transaction-history') },
    { icon: icons.shield, title: 'Requirements Checklist', action: () => { setRequirementsModalVisible(true); fetchReadiness(); } },
    { icon: icons.person, title: t('profile'), action: () => router.push('/edit-profile') },
    { icon: icons.calendar, title: 'Chat Settings & Backup', action: () => setChatSettingsVisible(true) },
    { 
      icon: icons.bell, 
      title: t('notifications_setting'), 
      action: () => {
        (socketService as any).socket?.emit('new_message', {
          conversation_id: 'test',
          sender_id: 'system',
          content: 'This is a test notification! It works perfectly.'
        });
        
        (socketService as any).socket?.io.engine.onPacket({
          type: 2, 
          nsp: '/', 
          data: ['new_message', {
            conversation_id: 'test',
            sender_id: 'system',
            content: 'Hello! This is a test notification from Swapster.'
          }]
        });
      }
    },
    { icon: icons.shield, title: t('security'), action: () => alert('Security Settings: Coming soon!') },
    { 
      icon: icons.language, 
      title: t('language'), 
      action: () => setLangModalVisible(true),
      rightText: getLangText()
    },
    { 
      icon: icons.edit, // Reusing an icon for theme toggle mock
      title: t('theme'), 
      action: () => setThemeModalVisible(true),
      rightText: getThemeText()
    },
    {
      icon: icons.info,
      title: 'Chat Backup',
      action: undefined,
      rightElement: <Switch 
        value={user?.chat_backup_enabled || false} 
        onValueChange={async (val) => {
          if (!user) return;
          try {
            const res = await api.updateUser(user.id, { chat_backup_enabled: val });
            setUser(res.user);
          } catch (e) {
            console.error(e);
          }
        }} 
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    },
    { icon: icons.info, title: t('help_center'), action: () => alert('Help Center: Coming soon!') },
    { icon: icons.people, title: t('invite_friends'), action: handleInvite },
  ];

  if (user?.role === 'superadmin') {
    menuItems.unshift({ icon: icons.shield, title: 'Admin Dashboard', action: () => router.push('/(admin)') });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Typography variant="h4" style={styles.title}>{t('profile')}</Typography>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: resolveImageUrl(user?.avatar_url) }} 
              style={styles.avatar} 
            />
            <TouchableOpacity style={[styles.editAvatarBtn, { backgroundColor: colors.primary, borderColor: colors.background }]} onPress={pickImage}>
              <Image source={icons.edit} style={styles.editIcon} />
            </TouchableOpacity>
          </View>
          <Typography variant="h3" style={styles.name}>{user?.display_name}</Typography>
        </View>

        {/* Menu Items */}
        <View style={styles.menuList}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItem}
              onPress={item.action}
              disabled={!item.action}
            >
              <Image source={item.icon} style={[styles.menuIcon, { tintColor: colors.black1 }]} />
              <Typography variant="h6" color={colors.black1} style={styles.menuTitle}>
                {item.title}
              </Typography>
              {item.rightText && (
                <Typography variant="body2" color={colors.primary} style={styles.rightText}>
                  {item.rightText}
                </Typography>
              )}
              {item.rightElement ? (
                item.rightElement
              ) : (
                <Image source={icons.rightArrow} style={[styles.arrowIcon, { tintColor: colors.black3 }]} />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Image source={icons.logout} style={[styles.menuIcon, { tintColor: colors.danger }]} />
            <Typography variant="h6" color={colors.danger} style={styles.menuTitle}>
              {t('logout')}
            </Typography>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Language Modal */}
      <SelectionModal 
        visible={langModalVisible} 
        onClose={() => setLangModalVisible(false)} 
        title={t('language')}
        options={[
          { label: t('english'), value: 'en' },
          { label: t('french'), value: 'fr' },
          { label: t('german'), value: 'de' },
          { label: t('chinese'), value: 'zh' },
          { label: t('spanish'), value: 'es' },
          { label: t('russian'), value: 'ru' }
        ]}
        selectedValue={language}
        onSelect={(val: string) => {
          setLanguage(val as any);
          setLangModalVisible(false);
        }}
        colors={colors}
      />

      {/* Theme Modal */}
      <SelectionModal 
        visible={themeModalVisible} 
        onClose={() => setThemeModalVisible(false)} 
        title={t('theme')}
        options={[
          { label: t('theme_light'), value: 'light' },
          { label: t('theme_dark'), value: 'dark' },
          { label: t('theme_system'), value: 'system' }
        ]}
        selectedValue={themePreference}
        onSelect={(val: string) => {
          setThemePreference(val as any);
          setThemeModalVisible(false);
        }}
        colors={colors}
      />
      
      {/* Chat Settings & Backup Modal */}
      <Modal visible={chatSettingsVisible} transparent animationType="slide" onRequestClose={() => setChatSettingsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setChatSettingsVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Typography variant="h4">Chat Backup (Cloud)</Typography>
              <TouchableOpacity onPress={() => setChatSettingsVisible(false)}>
                <Typography variant="h5" color={colors.primary}>Close</Typography>
              </TouchableOpacity>
            </View>
            <Typography variant="body1" color={colors.black2} style={{marginBottom: 20}}>
              Since messages are stored on your device for privacy, you can backup your chat history to the cloud to avoid losing them.
            </Typography>

            <TouchableOpacity 
              style={{ padding: 16, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', marginBottom: 12 }}
              onPress={async () => {
                 setBackupLoading(true);
                 try {
                   await backupDbToCloud();
                   Alert.alert('Success', 'Chats backed up to cloud successfully.');
                 } catch (e: any) {
                   Alert.alert('Error', e.message);
                 } finally {
                   setBackupLoading(false);
                 }
              }}
              disabled={backupLoading}
            >
               <Typography variant="h6" color="#FFF">{backupLoading ? 'Backing up...' : 'Backup Chats Now'}</Typography>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ padding: 16, backgroundColor: colors.card, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}
              onPress={async () => {
                 setBackupLoading(true);
                 try {
                   const success = await restoreDbFromCloud();
                   if (success) {
                      Alert.alert('Success', 'Chats restored from cloud successfully. Please restart the app or refresh chats.');
                   } else {
                      Alert.alert('Not Found', 'No backup found on the cloud.');
                   }
                 } catch (e: any) {
                   Alert.alert('Error', e.message);
                 } finally {
                   setBackupLoading(false);
                 }
              }}
              disabled={backupLoading}
            >
               <Typography variant="h6" color={colors.primary}>{backupLoading ? 'Restoring...' : 'Restore Chats'}</Typography>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Requirements Checklist Modal */}
      <Modal visible={requirementsModalVisible} transparent animationType="slide" onRequestClose={() => setRequirementsModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRequirementsModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Typography variant="h4">Readiness Checklist</Typography>
              <TouchableOpacity onPress={() => setRequirementsModalVisible(false)}>
                <Typography variant="h5" color={colors.primary}>Close</Typography>
              </TouchableOpacity>
            </View>

            {loadingReadiness || !readinessData ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Typography variant="body2" color={colors.black3} style={{ marginTop: 12 }}>Checking database...</Typography>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 24, padding: 16, backgroundColor: colors.card, borderRadius: 16 }}>
                  <Typography variant="h5" style={{ marginBottom: 8 }}>
                    Readiness Score: {readinessData.score}/{readinessData.total}
                  </Typography>
                  <Typography variant="body2" color={colors.black2} style={{ marginBottom: 12 }}>
                    You are {Math.round((readinessData.score / readinessData.total) * 100)}% ready to transact.
                  </Typography>
                  
                  {/* Progress Bar */}
                  <View style={{ height: 8, width: '100%', backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${(readinessData.score / readinessData.total) * 100}%`, backgroundColor: colors.primary }} />
                  </View>
                </View>

                {/* Checklist items */}
                <ChecklistItem 
                  checked={readinessData.phoneVerified} 
                  title="Phone number verified" 
                  desc="Required for PawaPay transactions"
                  onFix={() => {
                    setRequirementsModalVisible(false);
                    Alert.alert("Verify Phone", "Your phone number is linked and verified at onboarding.");
                  }}
                  colors={colors}
                />

                <ChecklistItem 
                  checked={readinessData.mobileNetworkDetected} 
                  title="Mobile network detected" 
                  desc="Correspondent auto-detected on profile"
                  onFix={() => {
                    setRequirementsModalVisible(false);
                    Alert.alert("Network Info", "Your network operator is predicted automatically from your phone format.");
                  }}
                  colors={colors}
                />

                <ChecklistItem 
                  checked={readinessData.profilePhotoUploaded} 
                  title="Profile photo uploaded" 
                  desc="A valid avatar image is set"
                  onFix={() => {
                    setRequirementsModalVisible(false);
                    pickImage();
                  }}
                  colors={colors}
                />

                <ChecklistItem 
                  checked={readinessData.servicePosted} 
                  title="At least one service posted" 
                  desc="You have published an offering"
                  onFix={() => {
                    setRequirementsModalVisible(false);
                    router.push('/post-service');
                  }}
                  colors={colors}
                />

                <ChecklistItem 
                  checked={readinessData.holdupAmountSet} 
                  title="Escrow hold set on all services" 
                  desc="No service has a null/zero holdup amount"
                  onFix={() => {
                    setRequirementsModalVisible(false);
                    router.push('/post-service');
                  }}
                  colors={colors}
                />

                <ChecklistItem 
                  checked={readinessData.walletFunded} 
                  title="Wallet is funded" 
                  desc="Wallet balance must be greater than 0"
                  onFix={async () => {
                    try {
                      setLoadingReadiness(true);
                      const topRes = await api.topUpWallet(5000);
                      Alert.alert("Wallet Funded", `Top up successful! Sandbox wallet credited. New balance: ${topRes.balance} XAF`);
                      fetchReadiness();
                    } catch (e: any) {
                      Alert.alert("Error", e.message || "Failed to top up");
                    } finally {
                      setLoadingReadiness(false);
                    }
                  }}
                  colors={colors}
                  fixLabel="TOP UP"
                />

                <ChecklistItem 
                  checked={readinessData.identityVerified} 
                  title="Identity verified" 
                  desc="Name matches mobile money account"
                  onFix={async () => {
                    if (!user) return;
                    try {
                      setLoadingReadiness(true);
                      const updatedUser = await api.updateUser(user.id, { identity_verified: true });
                      await setUser(updatedUser.user, undefined);
                      Alert.alert("Verified", "Sandbox identity matches mobile money account!");
                      fetchReadiness();
                    } catch (e: any) {
                      Alert.alert("Error", e.message || "Failed to verify identity");
                    } finally {
                      setLoadingReadiness(false);
                    }
                  }}
                  colors={colors}
                  fixLabel="VERIFY"
                />
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SelectionModal({ visible, onClose, title, options, selectedValue, onSelect, colors }: any) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <Typography variant="h4" style={styles.modalTitle}>{title}</Typography>
          {options.map((opt: any) => (
            <TouchableOpacity key={opt.value} style={[styles.radioItem, { borderBottomColor: colors.border }]} onPress={() => onSelect(opt.value)}>
              <Typography variant="h6" color={selectedValue === opt.value ? colors.primary : colors.black1}>{opt.label}</Typography>
              <View style={[styles.radioOuter, { borderColor: selectedValue === opt.value ? colors.primary : colors.black3 }]}>
                {selectedValue === opt.value && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  editIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFF',
  },
  name: {
    marginBottom: 8,
  },
  menuList: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
  },
  arrowIcon: {
    width: 20,
    height: 20,
  },
  rightText: {
    marginRight: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    marginBottom: 24,
    textAlign: 'center',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  }
});

function ChecklistItem({ checked, title, desc, onFix, colors, fixLabel = "FIX →" }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Typography variant="h4" style={{ marginRight: 16 }}>{checked ? "✅" : "❌"}</Typography>
      <View style={{ flex: 1 }}>
        <Typography variant="h6" color={checked ? colors.black1 : colors.black2}>{title}</Typography>
        <Typography variant="caption" color={colors.black3}>{desc}</Typography>
      </View>
      {!checked && (
        <TouchableOpacity style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }} onPress={onFix}>
          <Typography variant="caption" color="white" weight="bold">{fixLabel}</Typography>
        </TouchableOpacity>
      )}
    </View>
  );
}
