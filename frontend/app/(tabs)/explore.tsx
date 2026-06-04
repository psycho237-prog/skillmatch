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
  const { colors, t } = useApp();
  const router = useRouter();

  const [query, setQuery] = useState((q as string) || '');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      handleSearch();
    } else {
      // Default to get all services if no query
      handleSearch('');
    }
  }, []);

  const handleSearch = async (overrideQuery?: string) => {
    const qToUse = overrideQuery !== undefined ? overrideQuery : query;
    try {
      setLoading(true);
      if (!qToUse.trim()) {
         const res = await api.getServices();
         setResults(res.services || []);
      } else {
         const res = await api.searchServices(qToUse);
         setResults(res.services || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
        <TouchableOpacity style={[styles.filterBtn, { backgroundColor: colors.primary }]}>
          <Image source={icons.filter} style={[styles.filterIcon, { tintColor: '#FFF' }]} />
        </TouchableOpacity>
      </View>

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
            priceType={item.price_type}
            rating={item.rating}
            imageUrl={item.images?.[0] || 'https://via.placeholder.com/400'}
            variant="horizontal"
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
    backgroundColor: 'rgba(0,0,0,0.03)',
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
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  }
});
