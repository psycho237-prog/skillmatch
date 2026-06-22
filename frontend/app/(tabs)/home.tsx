import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { ServiceCard } from '../../src/components/ServiceCard';
import { Loader } from '../../src/components/Loader';
import { icons } from '../../src/constants';
import { api, resolveImageUrl } from '../../src/services/api';

export default function Home() {
  const { colors, t, user, notifications } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const compositeFeed = useMemo(() => {
    if (!recommended || recommended.length === 0) return [];

    const boostedPool = featured.filter(s => s.is_featured);
    const premiumPool = recommended.filter(s => s.users?.subscription_tier === 'premium' && !s.is_featured);
    const starPool = recommended.filter(s => s.rating > 2 && s.users?.subscription_tier !== 'premium' && !s.is_featured);
    
    let regularList = recommended.filter(s => 
      !s.is_featured && s.users?.subscription_tier !== 'premium' && (s.rating == null || s.rating <= 2)
    );
    if (regularList.length === 0) regularList = [...recommended];

    const feed = [];
    const totalSlots = Math.max(10, regularList.length);

    let bIdx = 0, pIdx = 0, sIdx = 0, rIdx = 0;

    for (let i = 1; i <= totalSlots; i++) {
      let injected = false;
      
      if (i % 2 === 0 && bIdx < boostedPool.length) {
        feed.push({ type: 'service', item: boostedPool[bIdx++] });
        injected = true;
      } else if (i % 6 === 0 && pIdx < premiumPool.length) {
        feed.push({ type: 'service', item: premiumPool[pIdx++] });
        injected = true;
      } else if (i % 10 === 0 && sIdx < starPool.length) {
        feed.push({ type: 'service', item: starPool[sIdx++] });
        injected = true;
      }
      
      if (i === Math.floor(totalSlots * 0.6)) {
        feed.push({ type: 'featured_slider_repeat' });
      }

      if (!injected && rIdx < regularList.length) {
        feed.push({ type: 'service', item: regularList[rIdx++] });
      }
    }

    while (rIdx < regularList.length) {
      feed.push({ type: 'service', item: regularList[rIdx++] });
    }

    return feed;
  }, [recommended, featured]);

  const renderFeaturedSlider = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Typography variant="h4">{t('featured') || 'Featured'}</Typography>
        <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
          <Typography variant="body2" color={colors.primary} weight="medium">{t('see_all') || 'See All'}</Typography>
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
  );


  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isHeaderHidden = useRef(false);
  const HEADER_HIDE_HEIGHT = 68; // padding(10) + avatar(40) + margin(18)

  const handleScroll = (e: any) => {
    const currentScrollY = e.nativeEvent.contentOffset.y;
    if (currentScrollY < 0) return; // Ignore bounce

    const diff = currentScrollY - lastScrollY.current;
    
    // Scrolling down -> hide
    if (diff > 5 && !isHeaderHidden.current) {
      isHeaderHidden.current = true;
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 300, // Soft transition
        useNativeDriver: false,
      }).start();
    } 
    // Scrolling up -> show
    else if (diff < -5 && isHeaderHidden.current) {
      isHeaderHidden.current = false;
      Animated.timing(headerAnim, {
        toValue: 0,
        duration: 300, // Soft transition
        useNativeDriver: false,
      }).start();
    }
    
    lastScrollY.current = currentScrollY;
  };

  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -HEADER_HIDE_HEIGHT],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Solid Status Bar Background to prevent content overlap during scroll */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background, zIndex: 101 }} />

      {/* Animated Header Overlay */}
      <Animated.View style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 100, 
        transform: [{ translateY: headerTranslateY }],
        backgroundColor: colors.background 
      }}>
        <View style={[styles.stickyHeader, { paddingTop: insets.top + 10 }]}>
          {/* Profile Header */}
          <View style={styles.header}>
            <View style={styles.profileInfo}>
              <Image
                source={{ uri: resolveImageUrl(user?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp') }}
                style={styles.avatar}
              />
              <View style={styles.greeting}>
                <Typography variant="caption" color={colors.black3}>{t(greetingKey as any)}</Typography>
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

          {/* Search Row and Categories */}
          <View style={{ backgroundColor: colors.background }}>
            <View style={[styles.searchRow, { paddingTop: 10 }]}>
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

            {!loading && (
              <View style={{ paddingVertical: 10, marginHorizontal: -4, paddingHorizontal: 4 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryScroll, { marginBottom: 0 }]}>
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
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: 270 }]} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View>
          {loading ? <Loader /> : (
            <>
              {featured.length > 0 && renderFeaturedSlider()}

              <View style={[styles.section, { flex: 1, marginTop: 10 }]}>
                <View style={styles.sectionHeader}>
                  <Typography variant="h4">{t('our_recommendation') || 'Our Recommendation'}</Typography>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                    <Typography variant="body2" color={colors.primary} weight="medium">{t('see_all') || 'See All'}</Typography>
                  </TouchableOpacity>
                </View>

                <View style={styles.grid}>
                  {compositeFeed.map((feedItem, index) => {
                    if (feedItem.type === 'featured_slider_repeat') {
                      return (
                        <View key={`featured-repeat-${index}`} style={{ width: '100%', marginVertical: 20 }}>
                          {renderFeaturedSlider()}
                        </View>
                      );
                    }

                    const item = feedItem.item;
                    return (
                      <ServiceCard
                        key={`service-${item.id}-${index}`}
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
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 24,
  },
  scroll: {
    padding: 4,
    paddingTop: 60, // Adjust for safe area
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
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
