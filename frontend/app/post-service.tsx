import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Image, FlatList, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { icons } from '../src/constants';

const CATEGORIES = ['Development', 'Design', 'Repair', 'Cleaning', 'Photography', 'Music', 'Other'];
const CURRENCIES = [
  { label: 'USD ($)', value: 'USD' },
  { label: 'EUR (€)', value: 'EUR' },
  { label: 'XAF (FCFA)', value: 'XAF' },
  { label: 'GBP (£)', value: 'GBP' },
  { label: 'CNY (¥)', value: 'CNY' },
  { label: 'RUB (₽)', value: 'RUB' },
];

const PRICE_TYPES: ('fixed' | 'hourly' | 'exchange')[] = ['fixed', 'hourly', 'exchange'];

export default function PostService() {
  const router = useRouter();
  const { colors, user, t } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Development');
  const [location, setLocation] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'hourly' | 'exchange'>('fixed');
  const [currency, setCurrency] = useState('USD');
  const [barterSkill, setBarterSkill] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setImageUris([...imageUris, ...uris].slice(0, 10));
    }
  };

  const removeImage = (index: number) => {
    setImageUris(imageUris.filter((_, i) => i !== index));
  };

  const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void }[]) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
      if (buttons && buttons[0].onPress) {
        buttons[0].onPress();
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || (priceType !== 'exchange' && !price) || !location) {
      showAlert(t('error'), t('fill_all_fields'));
      return;
    }

    try {
      setLoading(true);
      
      let uploadedUrls: string[] = [];
      if (imageUris.length > 0) {
        const uploadRes = await api.uploadImages(imageUris);
        uploadedUrls = uploadRes.urls;
      } else {
        uploadedUrls = ['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4']; // Default
      }

      await api.createService({
        user_id: user?.id,
        title,
        description,
        category,
        price: priceType === 'exchange' ? 0 : parseFloat(price),
        price_type: priceType,
        currency,
        barter_skill: priceType === 'exchange' ? barterSkill : null,
        location,
        images: uploadedUrls
      });
      
      showAlert(t('success'), t('post_success'), [
        { text: t('ok'), onPress: () => router.back() }
      ]);
    } catch (error: any) {
      showAlert(t('error'), error.message || 'Failed to post service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>{t('back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h4">{t('post_service')}</Typography>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('service_image')}</Typography>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {imageUris.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeBadge} onPress={() => removeImage(index)}>
                  <Typography variant="caption" color="white">×</Typography>
                </TouchableOpacity>
              </View>
            ))}
            {imageUris.length < 10 && (
              <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Typography variant="body2" color={colors.primary}>{imageUris.length === 0 ? t('add_images') : t('add_more_images')}</Typography>
              </TouchableOpacity>
            )}
          </ScrollView>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('title')}</Typography>
          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder={t('title_placeholder')}
              placeholderTextColor={colors.black3}
              style={[styles.input, { color: colors.black1 }]}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('category')}</Typography>
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
                <Typography variant="body2" color={cat === category ? 'white' : colors.black1}>{t(cat.toLowerCase() as any) || cat}</Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('description_label')}</Typography>
          <View style={[styles.inputGroup, styles.textAreaGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder={t('description_placeholder')}
              placeholderTextColor={colors.black3}
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea, { color: colors.black1 }]}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('price_type_label')}</Typography>
          <View style={styles.typeContainer}>
            {PRICE_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  { backgroundColor: priceType === type ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => setPriceType(type)}
              >
                <Typography variant="body2" color={priceType === type ? 'white' : colors.black1}>{t(type as any)}</Typography>
              </TouchableOpacity>
            ))}
          </View>

          {priceType !== 'exchange' ? (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('price_label')}</Typography>
                  <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      placeholder={t('price_placeholder')}
                      placeholderTextColor={colors.black3}
                      keyboardType="numeric"
                      style={[styles.input, { color: colors.black1 }]}
                      value={price}
                      onChangeText={setPrice}
                    />
                  </View>
                </View>
                <View style={{ width: 120 }}>
                  <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('currency_label')}</Typography>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
                    {CURRENCIES.map(curr => (
                      <TouchableOpacity
                        key={curr.value}
                        style={[
                          styles.currencyChip,
                          { backgroundColor: currency === curr.value ? colors.primary : colors.card, borderColor: colors.border }
                        ]}
                        onPress={() => setCurrency(curr.value)}
                      >
                        <Typography variant="caption" color={currency === curr.value ? 'white' : colors.black1}>{curr.value}</Typography>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </>
          ) : (
            <>
              <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('barter_skill_label')}</Typography>
              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  placeholder={t('barter_skill_placeholder')}
                  placeholderTextColor={colors.black3}
                  style={[styles.input, { color: colors.black1 }]}
                  value={barterSkill}
                  onChangeText={setBarterSkill}
                />
              </View>
            </>
          )}

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('location_label')}</Typography>
          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder={t('location_placeholder')}
              placeholderTextColor={colors.black3}
              style={[styles.input, { color: colors.black1 }]}
              value={location}
              onChangeText={setLocation}
            />
          </View>

          <Button
            title={t('publish')}
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
  backBtn: { width: 80 },
  placeholder: { width: 80 },
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
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  textAreaGroup: { height: 120, alignItems: 'flex-start', paddingTop: 12 },
  input: { flex: 1, fontSize: 16, fontFamily: 'Rubik-Regular' },
  textArea: { textAlignVertical: 'top' },
  categoryScroll: { flexDirection: 'row', marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  imageScroll: { flexDirection: 'row', marginBottom: 8 },
  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginRight: 12,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  removeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F75555',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
  },
  currencyScroll: { flexDirection: 'row' },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  btn: { width: '100%', borderRadius: 30, marginTop: 32 },
});
