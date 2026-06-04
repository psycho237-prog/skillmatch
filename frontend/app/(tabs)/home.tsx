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
import { icons } from '../../src/constants';
import { api } from '../../src/services/api';

export default function Home() {
  const { colors, t, user } = useApp();
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
        api.getFeaturedServices(),
        api.getServices(activeCategory !== 'All' ? { category: activeCategory } : undefined),
        api.getCategories()
      ]);

      setFeatured(featRes.services || []);
      setRecommended(recRes.services || []);
      setCategories([{ name: 'All' }, ...(catRes.categories || [])]);
    } catch (e) {
      console.error(e);
      // fallback mock data for visually developing immediately if backend is empty
      setCategories([{name: 'All'}, {name: 'Development'}, {name: 'Design'}, {name: 'Writing'}]);
      setFeatured([{
        id: '1', title: 'Full-Stack Web Dev', price: 75, price_type: 'hourly', location: 'San Francisco', rating: 4.8, images: ['https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800']
      }]);
      setRecommended([{
        id: '2', title: 'UI/UX Design', price: 90, price_type: 'hourly', location: 'Tokyo', rating: 4.9, images: ['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800']
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/(tabs)/explore', params: { q: searchQuery } });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* Header Profile Area */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <Image 
              source={{ uri: user?.avatar_url || 'https://www.gravatar.com/avatar/?d=mp' }} 
              style={styles.avatar} 
            />
            <View style={styles.greeting}>
              <Typography variant="caption" color={colors.black3}>{t('good_morning')}</Typography>
              <Typography variant="h5" color={colors.black1}>{user?.display_name || 'Guest'}</Typography>
            </View>
          </View>
          <TouchableOpacity style={[styles.bellBtn, { borderColor: colors.border }]}>
            <Image source={icons.bell} style={[styles.bellIcon, { tintColor: colors.black1 }]} />
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

        {loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />}

        {/* Featured Section */}
        {!loading && featured.length > 0 && (
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
                  priceType={item.price_type}
                  rating={item.rating}
                  imageUrl={item.images?.[0] || 'https://via.placeholder.com/400'}
                  variant="vertical"
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
                  priceType={item.price_type}
                  rating={item.rating}
                  imageUrl={item.images?.[0] || 'https://via.placeholder.com/400'}
                  variant="horizontal"
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
    marginBottom: 24,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  greeting: {
    justifyContent: 'center',
  },
  bellBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    width: 24,
    height: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
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
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    width: 24,
    height: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  },
});
