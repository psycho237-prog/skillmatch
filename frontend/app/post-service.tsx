import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { icons } from '../src/constants';

// Basic list of categories to pick from
const CATEGORIES = ['Development', 'Design', 'Repair', 'Cleaning', 'Photography', 'Music', 'Other'];

export default function PostService() {
  const router = useRouter();
  const { colors, user } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Development');
  const [location, setLocation] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !location) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await api.createService({
        user_id: user?.id,
        title,
        description,
        category,
        price: parseFloat(price),
        price_type: 'fixed',
        location,
        images: imageUri ? [imageUri] : ['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4'] // Default placeholder image
      });
      
      Alert.alert('Success', 'Your service has been posted!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>{'< Back'}</Typography>
        </TouchableOpacity>
        <Typography variant="h4">Post a Service</Typography>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.form}>
          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Service Image</Typography>
          <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <Typography variant="body2" color={colors.primary}>+ Add an Image</Typography>
            )}
          </TouchableOpacity>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Title</Typography>
          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="E.g. Full Stack Web Developer"
              placeholderTextColor={colors.black3}
              style={[styles.input, { color: colors.black1 }]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Category</Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity 
                key={cat} 
                style={[
                  styles.categoryChip, 
                  { backgroundColor: cat === category ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => setCategory(cat)}
              >
                <Typography variant="body2" color={cat === category ? 'white' : colors.black1}>{cat}</Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Description</Typography>
          <View style={[styles.inputGroup, styles.textAreaGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="Describe your service in detail..."
              placeholderTextColor={colors.black3}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea, { color: colors.black1 }]}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Price (Hourly/Fixed)</Typography>
          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="e.g. 50"
              placeholderTextColor={colors.black3}
              keyboardType="numeric"
              style={[styles.input, { color: colors.black1 }]}
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Location</Typography>
          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="Remote or e.g. London, UK"
              placeholderTextColor={colors.black3}
              style={[styles.input, { color: colors.black1 }]}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <Button
            title="Post Service"
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            style={styles.btn}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: { width: 60 },
  placeholder: { width: 60 },
  scroll: { flexGrow: 1, padding: 24 },
  form: { width: '100%' },
  label: { marginBottom: 8, marginTop: 16 },
  inputGroup: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textAreaGroup: { height: 120, alignItems: 'flex-start', paddingTop: 12 },
  input: { flex: 1, fontSize: 16, fontFamily: 'Inter-Medium' },
  textArea: { textAlignVertical: 'top' },
  categoryScroll: { flexDirection: 'row', marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  imagePicker: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  btn: { width: '100%', borderRadius: 30, marginTop: 32 },
});
