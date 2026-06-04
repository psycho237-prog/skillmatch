import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { icons } from '../../src/constants';
import { api } from '../../src/services/api';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, t, user } = useApp();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchService();
  }, [id]);

  const fetchService = async () => {
    try {
      const res = await api.getServiceById(id as string);
      setService(res.service);
    } catch (e) {
      console.error(e);
      // fallback mock object
      setService({
        id,
        title: 'Modernica Apartment (Demo)',
        description: 'The apartment is very clean and modern. I really like the interior design. Looks like I will feel at home.',
        price: 22452,
        price_type: 'fixed',
        rating: 4.8,
        review_count: 1275,
        location: 'Grand City St. 100, New York',
        images: ['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800','https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800'],
        users: { id: 'ext123', display_name: 'Charolette Hanlin', avatar_url: 'https://randomuser.me/api/portraits/women/44.jpg' },
      });
    } finally {
      setLoading(false);
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
      // If backend fails visually navigate anyway
      router.push(`/chat/new_${service.id}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = () => {
    if (!service) return '';
    if (service.price_type === 'exchange') return t('exchange');
    if (service.price_type === 'negotiable') return t('negotiable');
    const suffix = service.price_type === 'hourly' ? t('per_hour') : '';
    return `$${service.price}${suffix}`;
  };

  if (loading || !service) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Top Image & Header Header */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: service.images[0] }} style={styles.mainImage} />
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <Image source={icons.backArrow} style={styles.icon} />
            </TouchableOpacity>
            <Typography variant="h5" color="#FFF">Detail</Typography>
            <TouchableOpacity style={styles.iconBtn}>
              <Image source={icons.heart} style={styles.icon} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Typography variant="h3" style={styles.title}>{service.title}</Typography>
          
          <View style={styles.ratingRow}>
            <Image source={icons.star} style={styles.starIcon} />
            <Typography variant="h6" weight="bold">{service.rating.toFixed(1)}</Typography>
            <Typography variant="body2" color={colors.black3} style={styles.reviewCount}>
              ({service.review_count} {t('reviews')})
            </Typography>
          </View>

          <View style={styles.section}>
             <Typography variant="h5" style={styles.sectionTitle}>{t('description')}</Typography>
             <Typography variant="body1" color={colors.black2} style={{ lineHeight: 28 }}>
               {service.description}
             </Typography>
          </View>

          <View style={styles.section}>
            <Typography variant="h5" style={styles.sectionTitle}>{t('gallery')}</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {service.images.map((img: string, i: number) => (
                <Image key={i} source={{ uri: img }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </View>

          <View style={[styles.section, { paddingBottom: 40 }]}>
             <Typography variant="h5" style={styles.sectionTitle}>{t('location')}</Typography>
             <View style={styles.locationRow}>
               <Image source={icons.location} style={[styles.locationIcon, { tintColor: colors.primary }]} />
               <Typography variant="body1" color={colors.black2}>{service.location}</Typography>
             </View>
             {/* Map Placeholder */}
             <View style={[styles.mapPlaceholder, { backgroundColor: colors.card }]}>
               <Typography variant="body2" color={colors.black3}>Map Displayed Here</Typography>
             </View>
          </View>

        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.priceContainer}>
          <Typography variant="caption" color={colors.black3}>{t('price')}</Typography>
          <Typography variant="h2" color={colors.primary}>{formatPrice()}</Typography>
        </View>
        <Button 
          title={t('contact_now')} 
          onPress={handleContact} 
          style={styles.bookBtn}
          loading={loading}
        />
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
  },
  mainImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: '#FFF', // Overridden dynamically normally but relying on view bg below
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
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginRight: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  mapPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  bookBtn: {
    minWidth: 160,
  }
});
