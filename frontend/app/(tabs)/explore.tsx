import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { ServiceCard } from '../../src/components/ServiceCard';
import { icons } from '../../src/constants';
import { api } from '../../src/services/api';

export default function Explore() {
  const { q } = useLocalSearchParams();
  const { colors, t, user } = useApp();
  const router = useRouter();

  const [query, setQuery] = useState((q as string) || '');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [activePaymentFilter, setActivePaymentFilter] = useState('All');

  const categories = ['All', 'Development', 'Design', 'Repair', 'Cleaning', 'Photography', 'Music'];
  const paymentFilters = ['All', 'Skill to Skill', 'Cash to Skill'];

  useEffect(() => {
    if (query) {
      handleSearch();
    } else {
      // Default to get all services if no query
      handleSearch('');
    }
  }, []);

  const handleSearch = async (overrideQuery?: string, overrideCategory?: string, overridePayment?: string) => {
    const qToUse = overrideQuery !== undefined ? overrideQuery : query;
    const cToUse = overrideCategory !== undefined ? overrideCategory : activeFilter;
    const pToUse = overridePayment !== undefined ? overridePayment : activePaymentFilter;

    try {
      setLoading(true);
      const payload: any = {};
      if (cToUse !== 'All') payload.category = cToUse;
      if (pToUse === 'Skill to Skill') payload.payment_type = 'skill';
      if (pToUse === 'Cash to Skill') payload.payment_type = 'cash';

      if (!qToUse.trim()) {
         const res = await api.getServices(payload, user?.id);
         setResults(res.services || []);
      } else {
         const res = await api.searchServices(qToUse, payload, user?.id);
         setResults(res.services || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (serviceId: string) => {
    if (!user) {
      alert(t('login_required'));
      return;
    }

    // Optimistic Update
    setResults(prev => prev.map(item => {
      if (item.id === serviceId) {
        const currentlyFavorited = !!item.is_favorited;
        return { 
          ...item, 
          is_favorited: !currentlyFavorited,
          likes_count: Number(item.likes_count || 0) + (currentlyFavorited ? -1 : 1)
        };
      }
      return item;
    }));

    try {
      await api.toggleFavorite(serviceId, user.id);
    } catch (e) {
      console.error(e);
      handleSearch(); // Rollback
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card }]} onPress={() => router.back()}>
          <Image source={icons.backArrow} style={[styles.backIcon, { tintColor: colors.black1 }]} />
        </TouchableOpacity>
        <Typography variant="h4" style={styles.title}>{t('explore')}</Typography>
        <View style={styles.backBtn} />{/* Empty view for alignment wrapper */}
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
          <Image source={icons.search} style={[styles.searchIcon, { tintColor: colors.black2 }]} />
          <TextInput
            style={[styles.searchInput, { color: colors.black1 }]}
            placeholder={t('search_placeholder')}
            placeholderTextColor={colors.black3}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: showFilters ? colors.primary : colors.card }]} onPress={() => setShowFilters(!showFilters)}>
          <Image source={icons.filter} style={[styles.filterIcon, { tintColor: showFilters ? '#FFF' : colors.primary }]} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { paddingBottom: 8 }]}>
            {categories.map((cat) => (
              <TouchableOpacity 
                key={cat} 
                style={[
                  styles.categoryPill, 
                  { backgroundColor: activeFilter === cat ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => {
                  setActiveFilter(cat);
                  handleSearch(query, cat, activePaymentFilter);
                }}
              >
                <Typography variant="body2" color={activeFilter === cat ? '#FFF' : colors.black1}>{cat}</Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {paymentFilters.map((pf) => (
              <TouchableOpacity 
                key={pf} 
                style={[
                  styles.categoryPill, 
                  { backgroundColor: activePaymentFilter === pf ? colors.primary : colors.card, borderColor: colors.border }
                ]}
                onPress={() => {
                  setActivePaymentFilter(pf);
                  handleSearch(query, activeFilter, pf);
                }}
              >
                <Typography variant="body2" color={activePaymentFilter === pf ? '#FFF' : colors.black1}>{pf}</Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Typography variant="h5" style={styles.resultCount}>
        {t('found_services').replace('{count}', String(results.length))}
      </Typography>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {results.map((item) => (
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
        {results.length === 0 && !loading && (
          <View style={styles.empty}>
             <Typography variant="body1" color={colors.black2}>{t('no_results_desc')}</Typography>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    width: 24,
    height: 24,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 24,
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
  resultCount: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  filterRow: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  }
});
