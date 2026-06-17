import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TextInput, Alert, TouchableOpacity, Image, FlatList, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { api } from '../src/services/api';
import { icons } from '../src/constants';

const CATEGORIES = ['Development', 'Design', 'Repair', 'Cleaning', 'Photography', 'Music', 'Other'];

const PAWAPAY_COUNTRIES = [
  { name: 'Cameroon (XAF)', code: 'CMR', currency: 'XAF' },
  { name: 'Ivory Coast (XOF)', code: 'CIV', currency: 'XOF' },
  { name: 'Senegal (XOF)', code: 'SEN', currency: 'XOF' },
  { name: 'Ghana (GHS)', code: 'GHA', currency: 'GHS' },
  { name: 'Kenya (KES)', code: 'KEN', currency: 'KES' },
  { name: 'Uganda (UGX)', code: 'UGA', currency: 'UGX' },
  { name: 'Zambia (ZMW)', code: 'ZMB', currency: 'ZMW' },
  { name: 'Rwanda (RWF)', code: 'RWA', currency: 'RWF' },
];

export default function PostService() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isEditMode = !!id;
  const { colors, user, t, theme } = useApp();
  
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Development');
  const [location, setLocation] = useState('');
  const [priceType, setPriceType] = useState<'fixed' | 'hourly' | 'exchange'>('fixed');
  const [currency, setCurrency] = useState('XAF');
  const [selectedCountry, setSelectedCountry] = useState('CMR');
  const [barterSkill, setBarterSkill] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [serviceType, setServiceType] = useState<'SKILL_TO_CASH' | 'SKILL_TO_SKILL'>('SKILL_TO_CASH');
  const [holdupAmount, setHoldupAmount] = useState('');

  useEffect(() => {
    if (isEditMode && id) {
      fetchServiceDetails();
    }
  }, [id]);

  const fetchServiceDetails = async () => {
    try {
      setLoading(true);
      const res = await api.getServiceById(id as string);
      const s = res.service;
      if (s) {
        setTitle(s.title || '');
        setDescription(s.description || '');
        setPrice(String(s.price || ''));
        setCategory(s.category || 'Development');
        setLocation(s.location || '');
        setPriceType(s.price_type || 'fixed');
        setCurrency(s.currency || 'XAF');
        setBarterSkill(s.barter_skill || '');
        setImageUris(s.images || []);
        setServiceType(s.service_type || 'SKILL_TO_CASH');
        setHoldupAmount(s.holdup_amount ? String(s.holdup_amount) : '');
        setSelectedCountry(s.country || 'CMR');
      }
    } catch (e) {
      console.error('Failed to load service detail:', e);
      Alert.alert('Error', 'Failed to load service details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    const countryObj = PAWAPAY_COUNTRIES.find(c => c.code === countryCode);
    if (countryObj) {
      setCurrency(countryObj.currency);
    }
  };

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

  const handleServiceTypeChange = (type: 'SKILL_TO_CASH' | 'SKILL_TO_SKILL') => {
    setServiceType(type);
    if (type === 'SKILL_TO_SKILL') {
      setPriceType('exchange');
      setPrice('0');
    } else {
      setPriceType('fixed');
      setPrice('');
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || (serviceType === 'SKILL_TO_CASH' && !price) || !location) {
      showAlert(t('error'), t('fill_all_fields'));
      return;
    }

    if (!serviceType) {
      showAlert(t('error'), 'Please select a service type.');
      return;
    }

    const parsedHold = serviceType === 'SKILL_TO_CASH' ? 0.00 : parseFloat(holdupAmount);
    if (serviceType === 'SKILL_TO_SKILL' && (isNaN(parsedHold) || parsedHold <= 0)) {
      showAlert(t('error'), 'Holdup amount must be a number greater than 0.');
      return;
    }

    try {
      setLoading(true);
      
      let uploadedUrls: string[] = [];
      const localImages = imageUris.filter(uri => uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://') || uri.startsWith('data:'));
      const existingImages = imageUris.filter(uri => uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('/uploads'));

      if (localImages.length > 0) {
        const uploadRes = await api.uploadImages(localImages);
        uploadedUrls = [...existingImages, ...uploadRes.urls];
      } else if (existingImages.length > 0) {
        uploadedUrls = existingImages;
      } else {
        uploadedUrls = ['https://images.unsplash.com/photo-1517245386807-bb43f82c33c4']; // Default
      }

      const serviceData = {
        user_id: user?.id,
        title,
        description,
        category,
        price: serviceType === 'SKILL_TO_SKILL' ? 0 : parseFloat(price),
        price_type: serviceType === 'SKILL_TO_SKILL' ? 'exchange' : priceType,
        currency,
        barter_skill: serviceType === 'SKILL_TO_SKILL' ? barterSkill : null,
        location,
        images: uploadedUrls,
        service_type: serviceType,
        holdup_amount: parsedHold,
        country: selectedCountry
      };

      if (isEditMode && id) {
        await api.updateService(id as string, serviceData);
        showAlert(t('success'), 'Service updated successfully!', [
          { text: t('ok'), onPress: () => router.back() }
        ]);
      } else {
        await api.createService(serviceData);
        showAlert(t('success'), t('post_success'), [
          { text: t('ok'), onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      showAlert(t('error'), error.message || 'Failed to submit service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Typography variant="body1" color={colors.primary}>{t('back')}</Typography>
        </TouchableOpacity>
        <Typography variant="h4">{isEditMode ? 'Update Service' : t('post_service')}</Typography>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>{t('service_image')}</Typography>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
            {imageUris.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={[styles.removeBadge, { backgroundColor: colors.danger, borderColor: colors.background }]} onPress={() => removeImage(index)}>
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

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Escrow Model Type</Typography>
          <View style={styles.typeContainer}>
            {(['SKILL_TO_CASH', 'SKILL_TO_SKILL'] as const).map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  { backgroundColor: serviceType === type ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => handleServiceTypeChange(type)}
              >
                <Typography variant="body2" color={serviceType === type ? 'white' : colors.black1}>
                  {type === 'SKILL_TO_CASH' ? 'Skill-to-Cash' : 'Skill-to-Skill'}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>

          {serviceType === 'SKILL_TO_SKILL' && (
            <>
              <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Holdup Amount (Commitment Hold)</Typography>
              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  placeholder="e.g. 500"
                  placeholderTextColor={colors.black3}
                  keyboardType="numeric"
                  style={[styles.input, { color: colors.black1 }]}
                  value={holdupAmount}
                  onChangeText={setHoldupAmount}
                />
              </View>
            </>
          )}

          <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>PawaPay Target Country</Typography>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {PAWAPAY_COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.code}
                style={[
                  styles.categoryChip,
                  { backgroundColor: selectedCountry === c.code ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => handleCountryChange(c.code)}
              >
                <Typography variant="body2" color={selectedCountry === c.code ? 'white' : colors.black1}>{c.name}</Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {serviceType === 'SKILL_TO_CASH' ? (
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
                  <Typography variant="body2" weight="bold" color={colors.black2} style={styles.label}>Currency (Locked)</Typography>
                  <View style={[styles.inputGroup, { backgroundColor: colors.border + '30', borderColor: colors.border, justifyContent: 'center', paddingHorizontal: 16 }]}>
                    <Typography variant="body2" color={colors.black1} weight="bold">{currency}</Typography>
                  </View>
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
            title={isEditMode ? 'Update' : t('publish')}
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
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
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
  typeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
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
