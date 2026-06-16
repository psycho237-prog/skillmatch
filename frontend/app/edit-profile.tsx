import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { icons } from '../src/constants';
import { api, resolveImageUrl } from '../src/services/api';

export default function EditProfile() {
  const router = useRouter();
  const { colors, user, setUser } = useApp();
  
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [avatarUri, setAvatarUri] = useState(resolveImageUrl(user?.avatar_url));
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    if (!user?.id) return;

    setLoading(true);
    try {
      let finalAvatarUrl = user?.avatar_url;

      // If avatar changed and is a local URI
      if (avatarUri && !avatarUri.startsWith('http')) {
        const uploadRes = await api.uploadImages([avatarUri]);
        finalAvatarUrl = uploadRes.urls[0];
      }

      // Update backend
      const updateRes = await api.updateUser(user.id, { 
        display_name: displayName,
        avatar_url: finalAvatarUrl
      });
      
      // Update context
      await setUser(updateRes.user, undefined);
      
      Alert.alert('Success', 'Profile updated successfully!');
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Update failed', e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.primary }]} />
          <Typography variant="body1" color={colors.primary} style={{marginLeft: -5}}>Cancel</Typography>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Typography variant="h6" style={styles.title}>Edit Profile</Typography>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Typography variant="body1" style={{fontFamily: 'Rubik-Bold'}} color={colors.primary}>Save</Typography>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
            <Image 
              source={{ uri: avatarUri || 'https://www.gravatar.com/avatar/?d=mp' }} 
              style={styles.avatar} 
            />
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
              <Image source={icons.edit} style={{width: 14, height: 14, tintColor: '#FFF'}} />
            </View>
          </TouchableOpacity>
          <Typography variant="body2" color={colors.primary} style={{marginTop: 12}}>Change Profile Photo</Typography>
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Typography variant="caption" color={colors.black3} style={styles.label}>Name</Typography>
          <TextInput
            style={[styles.input, { color: colors.black1 }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your Name"
            placeholderTextColor={colors.black3}
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.6 }]}>
          <Typography variant="caption" color={colors.black3} style={styles.label}>Phone Number</Typography>
          <TextInput
            style={[styles.input, { color: colors.black1 }]}
            value={user?.phone_number || ''}
            editable={false}
          />
          <Typography variant="caption" color={colors.black3} style={{marginTop: 8}}>Phone number cannot be changed.</Typography>
        </View>
      </View>
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
  saveBtn: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  inputGroup: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontFamily: 'Rubik-Medium',
  },
  input: {
    fontFamily: 'Rubik-Regular',
    fontSize: 16,
    padding: 0,
  }
});
