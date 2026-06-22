import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { ServiceCard } from '../../src/components/ServiceCard';
import { Loader } from '../../src/components/Loader';
import { icons } from '../../src/constants';
import { api, resolveImageUrl } from '../../src/services/api';

export default function Home() {
  const { colors, t, user, notifications } = useApp();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const [featured, setFeatured] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeCategory]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Run queries in parallel
      const [featRes, recRes, catRes] = await Promise.all([
        api.getFeaturedServices(user?.id),
        api.getServices(activeCategory !== 'All' ? { category: activeCategory } : undefined, user?.id),
        api.getCategories()
      ]);

      setFeatured(featRes.services || []);
      setRecommended(recRes.services || []);
      const fetchedCats = (catRes.categories || []).filter((c: any) => c.name.toLowerCase() !== 'all');
      setCategories([{ name: 'All' }, ...fetchedCats]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/(tabs)/explore', params: { q: searchQuery } });
    }
  };

  const handleToggleFavorite = async (serviceId: string) => {
    if (!user) {
      alert(t('login_required'));
      return;
    }

    // Optimistic Update
    const updater = (list: any[]) => list.map(item => {
      if (item.id === serviceId) {
        const currentlyFavorited = !!item.is_favorited;
        return {
          ...item,
          is_favorited: !currentlyFavorited,
          likes_count: Number(item.likes_count || 0) + (currentlyFavorited ? -1 : 1)
        };
      }
      return item;
    });

    setFeatured(prev => updater(prev));
    setRecommended(prev => updater(prev));

    try {
      await api.toggleFavorite(serviceId, user.id);
      // Optional: re-fetch to ensure sync, but the local update should be enough
      // fetchData(); 
    } catch (e) {
      console.error(e);
      // Rollback on error
      fetchData();
    }
  };

  const currentHour = new Date().getHours();
  let greetingKey = 'good_evening';
  if (currentHour >= 5 && currentHour < 12) {
    greetingKey = 'good_morning';
  } else if (currentHour >= 12 && currentHour < 18) {
    greetingKey = 'good_afternoon';
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header Profile Area */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <Image
              source={{ uri: resolveImageUrl(user?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp') }}
              style={styles.avatar}
            />
            <View style={styles.greeting}>
              <Typography variant="caption" color={colors.black3}>{t(greetingKey as TranslationKey)}</Typography>
              <Typography variant="h5" color={colors.black1}>{user?.display_name || 'Guest'}</Typography>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.bellBtn, { borderColor: colors.border }]}
            onPress={() => router.push('/notifications')}
          >
            <Image source={icons.bell} style={[styles.bellIcon, { tintColor: colors.black1 }]} />
            {notifications.filter(n => !n.read).length > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Typography variant="caption" color="white" weight="bold" style={styles.badgeText}>
                  {notifications.filter(n => !n.read).length}
                </Typography>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
            <Image source={icons.search} style={[styles.searchIcon, { tintColor: colors.black2 }]} />
            <TextInput
              style={[styles.searchInput, { color: colors.black1 }]}
              placeholder={t('search_placeholder')}
              placeholderTextColor={colors.black3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.primary }]}>
            <Image source={icons.filter} style={[styles.filterIcon, { tintColor: '#FFF' }]} />
          </TouchableOpacity>
        </View>

        {loading && <Loader />}
        {!loading /*&& featured.length > 0*/ && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Typography variant="h4">{t('featured')}</Typography>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                <Typography variant="body2" color={colors.primary} weight="medium">{t('see_all')}</Typography>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {featured.map((item) => (
                <ServiceCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  location={item.location}
                  price={item.price}
                  currency={item.currency}
                  priceType={item.price_type}
                  rating={item.rating}
                  imageUrl={item.images?.[0] || 'https://via.placeholder.com/400'}
                  variant="vertical"
                  isFavorited={!!item.is_favorited}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                  holdupAmount={item.holdup_amount}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories / Recommendation Header */}
        {!loading && (
          <View style={[styles.section, { flex: 1, marginBottom: 0 }]}>
            <View style={styles.sectionHeader}>
              <Typography variant="h4">{t('our_recommendation')}</Typography>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                <Typography variant="body2" color={colors.primary} weight="medium">{t('see_all')}</Typography>
              </TouchableOpacity>
            </View>

            {/* Category Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {categories.map((cat, idx) => {
                const isActive = activeCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.catPill,
                      { backgroundColor: isActive ? colors.primary : colors.inputBg }
                    ]}
                    onPress={() => setActiveCategory(cat.name)}
                  >
                    <Typography
                      variant="body2"
                      weight="medium"
                      color={isActive ? '#FFF' : colors.black2}
                    >
                      {t((cat.name.toLowerCase()) as any) || cat.name}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Recommendations List */}
            <View style={styles.grid}>
              {recommended.map((item) => (
                <ServiceCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  location={item.location}
                  price={item.price}
                  currency={item.currency}
                  priceType={item.price_type}
                  rating={item.rating}
                  imageUrl={item.images?.[0] || 'https://via.placeholder.com/400'}
                  variant="horizontal"
                  isFavorited={!!item.is_favorited}
                  onToggleFavorite={() => handleToggleFavorite(item.id)}
                  holdupAmount={item.holdup_amount}
                />

              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 24,
    paddingTop: 60, // Adjust for safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: -20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  greeting: {
    justifyContent: 'center',
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    width: 24,
    height: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginRight: 16,
  },
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Rubik-Regular',
    fontSize: 14,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    width: 24,
    height: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  hScroll: {
    paddingRight: 24, // bleed compensator
  },
  categoryScroll: {
    marginBottom: 20,
  },
  catPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
  },
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
