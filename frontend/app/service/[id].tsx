import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { Loader } from '../../src/components/Loader';
import { icons, images } from '../../src/constants';
import { api, resolveImageUrl } from '../../src/services/api';

export default function ServiceDetail() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, t, user } = useApp();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    fetchService();
  }, [id, user]);

  const fetchService = async () => {
    try {
      const res = await api.getServiceById(id as string, user?.id);
      setService(res.service);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user || !service) {
      showAlert(t('error'), t('login_required'));
      return;
    }
    try {
      const res = await api.toggleFavorite(service.id, user.id);
      await fetchService();
    } catch (e) {
      console.error(e);
    }
  };

  const nextImage = () => {
    if (service && activeImage < service.images.length - 1) {
      setActiveImage(activeImage + 1);
    }
  };

  const prevImage = () => {
    if (activeImage > 0) {
      setActiveImage(activeImage - 1);
    }
  };

  const handleContact = async () => {
    if (!user || !service) return;
    try {
      setLoading(true);
      const res = await api.createConversation(user.id, service.users.id, service.id);
      router.push(`/chat/${res.conversation.id}`);
    } catch (error) {
      console.error('Failed to create conv', error);
      router.push(`/chat/new_${service.id}`);
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (code: string) => {
    const symbols: Record<string, string> = {
      'USD': '$', 'EUR': '€', 'XAF': 'FCFA', 'GBP': '£', 'CNY': '¥', 'RUB': '₽'
    };
    return symbols[code] || code;
  };

  const formatPrice = () => {
    if (!service) return '';
    if (service.price_type === 'exchange') return t('exchange');
    if (service.price_type === 'negotiable') return t('negotiable');
    
    const symbol = getCurrencySymbol(service.currency || 'USD');
    const suffix = service.price_type === 'hourly' ? t('per_hour') : '';
    
    if (service.currency === 'XAF') {
      return `${service.price}${suffix} ${symbol}`;
    }
    return `${symbol}${service.price}${suffix}`;
  };

  const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void }[]) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
      if (buttons && buttons.length > 0 && buttons[0].onPress) {
         // Fallback logic could go here
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const submitRating = async (ratingVal: number) => {
    if (!user || !service) return;
    try {
      setLoading(true);
      await api.rateService(service.id, user.id, ratingVal);
      await fetchService();
      showAlert(t('success'), t('rating_success'));
    } catch (e) {
      console.error(e);
      showAlert(t('error'), t('rating_error'));
    } finally {
      setLoading(false);
    }
  };

  const showRatePrompt = () => {
    if (!user) {
      showAlert(t('error'), t('login_required'));
      return;
    }
    if (Platform.OS === 'web') {
      const val = window.prompt(t('rate_prompt') + " (1-5)", "5");
      if (val && parseInt(val) >= 1 && parseInt(val) <= 5) {
        submitRating(parseInt(val));
      }
      return;
    }
    Alert.alert(
      t('rate_service'),
      t('rate_prompt'),
      [
        { text: '5★', onPress: () => submitRating(5) },
        { text: '4★', onPress: () => submitRating(4) },
        { text: '3★', onPress: () => submitRating(3) },
        { text: '2★', onPress: () => submitRating(2) },
        { text: '1★', style: 'destructive', onPress: () => submitRating(1) },
        { text: t('cancel') }
      ]
    );
  };

  if (loading || !service) {
    return <Loader fullScreen />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Top Image & Header */}
        <View style={styles.imageContainer}>
          <ScrollView 
            horizontal 
            pagingEnabled 
            contentOffset={{ x: activeImage * width, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const nextIndex = Math.round(e.nativeEvent.contentOffset.x / width);
              setActiveImage(nextIndex);
            }}
            showsHorizontalScrollIndicator={false}
          >
            {service.images.map((img: string, i: number) => (
              <Image key={i} source={{ uri: resolveImageUrl(img) }} style={[styles.mainImage, { width }]} resizeMode='cover'/>
            ))}
          </ScrollView>

          {/* Direction Toggles */}
          {service.images.length > 1 && (
            <>
              {activeImage > 0 && (
                <TouchableOpacity style={[styles.navBtn, styles.leftBtn]} onPress={prevImage}>
                  <Image source={icons.backArrow} style={[styles.navIcon, { transform: [{ rotate: '0deg' }] }]} />
                </TouchableOpacity>
              )}
              {activeImage < service.images.length - 1 && (
                <TouchableOpacity style={[styles.navBtn, styles.rightBtn]} onPress={nextImage}>
                  <Image source={icons.backArrow} style={[styles.navIcon, { transform: [{ rotate: '180deg' }] }]} />
                </TouchableOpacity>
              )}
            </>
          )}
          
          <View style={styles.imageOverlay}>
            <View style={styles.header}>
              <TouchableOpacity style={[styles.iconBtn,{backgroundColor: colors.icon_bg}]} onPress={() => router.back()}>
                <Image source={icons.backArrow} style={styles.icon} />
              </TouchableOpacity>
              <Typography variant="h5" color="white">{t('detail')}</Typography>
              <TouchableOpacity onPress={handleToggleFavorite} style={[styles.iconBtn,{backgroundColor:colors.icon_bg}]}>
                <Image source={!!service.is_favorited ? icons.heartFilled : icons.heart} style={[styles.icon, !!service.is_favorited && { tintColor: colors.pink }]} />
              </TouchableOpacity>
            </View>

            {service.images.length > 1 && (
              <View style={styles.pagination}>
                {service.images.map((_: any, i: number) => (
                  <View 
                    key={i} 
                    style={[
                      styles.dot, 
                      { backgroundColor: i === activeImage ? colors.primary : 'rgba(255,255,255,0.5)' }
                    ]} 
                  />
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={[styles.content, {backgroundColor: colors.bg_description}]}>
          <Typography variant="h3" style={styles.title}>{service.title}</Typography>
          <TouchableOpacity style={styles.ratingRow} onPress={showRatePrompt}>
            <Image source={icons.star} style={styles.starIcon} />
            <Typography variant="h6" weight="bold">{Number(service.rating || 0).toFixed(1)}</Typography>
            <Typography variant="body2" color={colors.black3} style={styles.reviewCount}>
              ({service.review_count} {t('reviews')})
            </Typography>
            <View style={[styles.likesBadge, { backgroundColor: colors.pink + '20' }]}>
                <Image source={icons.heart} style={[styles.miniHeart, { tintColor: colors.pink }]} />
                <Typography variant="body2" weight="bold" color={colors.pink}>{Number(service.likes_count || 0)}</Typography>
            </View>
            <Typography variant="body2" color={colors.black3} style={{ marginLeft: 8 }}>
                • {t('tap_to_rate')}
            </Typography>
          </TouchableOpacity>

           <View style={styles.section}>
              <Typography variant="h5" style={styles.sectionTitle}>{t('description')}</Typography>
              <Typography variant="body1" color={colors.black2} style={{ lineHeight: 28 }}>
                 {service.description}
              </Typography>
           </View>

           {service.service_type && (
             <View style={styles.section}>
               <Typography variant="h5" style={styles.sectionTitle}>Escrow Settings</Typography>
               <View style={[styles.barterBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                 <Typography variant="body1" color={colors.black1} style={{ marginBottom: 4 }}>
                   <Typography weight="bold">Type:</Typography> {service.service_type === 'SKILL_TO_CASH' ? 'Skill-to-Cash' : 'Skill-to-Skill'}
                 </Typography>
                 <Typography variant="body1" color={colors.black1}>
                   <Typography weight="bold">Commitment Hold:</Typography> {service.holdup_amount} {service.currency || 'XAF'}
                 </Typography>
               </View>
             </View>
           )}

          {service.price_type === 'exchange' && service.barter_skill && (
            <View style={styles.section}>
              <Typography variant="h5" style={styles.sectionTitle}>{t('barter_skill_label')}</Typography>
              <View style={[styles.barterBox, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <Typography variant="body1" color={colors.primary}>{service.barter_skill}</Typography>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Typography variant="h5" style={styles.sectionTitle}>{t('gallery')}</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {service.images.map((img: string, i: number) => (
                <TouchableOpacity key={i} onPress={() => setActiveImage(i)}>
                  <Image source={{ uri: resolveImageUrl(img) }} style={[styles.galleryImage, { borderColor: activeImage === i ? colors.primary : 'transparent', borderWidth: 2 }]} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Typography variant="h5" style={styles.sectionTitle}>{t('location')}</Typography>
            <View style={styles.locationRow}>
              <Image source={icons.location} style={[styles.locationIcon, { tintColor: colors.primary }]} />
              <Typography variant="body1" color={colors.black1}>{service.location}</Typography>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.priceContainer}>
          <Typography variant="caption" color={colors.black3}>{t('price')}</Typography>
          <Typography variant="h2" color={colors.primary} numberOfLines={1}>{formatPrice()}</Typography>
        </View>
        {user?.id === service.user_id || user?.id === service.users?.id ? (
          <Button 
            title="Delete Service" 
            onPress={async () => {
              Alert.alert(
                "Delete Service",
                `Are you sure you want to delete "${service.title}"?`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        setLoading(true);
                        await api.deleteService(service.id);
                        showAlert("Success", "Service deleted successfully.");
                        router.back();
                      } catch (err: any) {
                        console.error(err);
                        showAlert("Error", err.message || "Failed to delete service.");
                      } finally {
                        setLoading(false);
                      }
                    }
                  }
                ]
              );
            }} 
            style={[styles.bookBtn, { backgroundColor: colors.danger }]}
            loading={loading}
          />
        ) : (
          <Button 
            title={t('contact_now')} 
            onPress={handleContact} 
            style={styles.bookBtn}
            loading={loading}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 100 },
  imageContainer: {
    width: '100%',
    height: 350,
    position: 'relative',
  },
  mainImage: {
    height: 350,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 20,
    height: 20,
    tintColor: '#FFF',
  },
  content: {
    padding: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  title: {
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  starIcon: {
    width: 16,
    height: 16,
    tintColor: '#FFB800',
    marginRight: 6,
  },
  reviewCount: {
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  barterBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  galleryImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    marginRight: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flex: 1,
    marginRight: 12,
  },
  bookBtn: {
    minWidth: 160,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  leftBtn: {
    left: 16,
  },
  rightBtn: {
    right: 16,
  },
  navIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFF',
  },
  likesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  miniHeart: {
    width: 12,
    height: 12,
    marginRight: 4,
  }
});
