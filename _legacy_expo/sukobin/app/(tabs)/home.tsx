import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '@/_components/Header';
import Categories from '@/_components/Categories';
import ProductCard, { Product } from '@/_components/ProductCard';
import FloatingCart from '@/_components/FloatingCart';
import { useCart } from '@/_components/cartContext';
import api from '@/utils/api';

const CACHE_KEY           = 'sukobin_products_cache';
const CACHE_TIMESTAMP_KEY = 'sukobin_products_timestamp';
const CACHE_DURATION      = 5 * 60 * 1000;

export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [products, setProducts]             = useState<Product[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [loadingMore, setLoadingMore]       = useState(false);
  const [hasMore, setHasMore]               = useState(true);
  const [currentPage, setCurrentPage]       = useState(1);
  const [totalProducts, setTotalProducts]   = useState(0);
  const [error, setError]                   = useState<string | null>(null);

  // ── Cart (shared context — single source of truth across the app) ─────────
  // The context handles the API calls (/api/cart/add, /update/:id, /remove/:id)
  // and drives the FloatingCart badge.
  const { addToCart, updateQuantity, removeFromCart, getQuantity, refreshCart } = useCart();

  const handleAddToCart = (product: Product) => addToCart(product, 1);

  const handleUpdateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    return updateQuantity(productId, qty);
  };

  // ── Cache ────────────────────────────────────────────────────────────────
  const loadFromCache = async (): Promise<boolean> => {
    try {
      const [raw, ts] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_TIMESTAMP_KEY),
      ]);
      if (!raw || !ts) return false;
      if (Date.now() - parseInt(ts) >= CACHE_DURATION) return false;
      const data = JSON.parse(raw);
      setProducts(data.products ?? []);
      setTotalProducts(data.totalProducts ?? 0);
      setHasMore(data.hasMore ?? false);
      setCurrentPage(data.currentPage ?? 1);
      return true;
    } catch { return false; }
  };

  const saveToCache = async (data: any) => {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch {}
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchProducts = async (
    page = 1,
    reset = false,
    category = activeCategory,
  ) => {
    try {
      setError(null);
      if (reset) {
        setLoading(true);
        if (page === 1) setProducts([]);
        setCurrentPage(1);
        setHasMore(true);
      }

      // Try cache only on first load of "All"
      if (page === 1 && reset && category === 'All') {
        const hit = await loadFromCache();
        if (hit) { setLoading(false); return; }
      }

      const url = category === 'All'
        ? `/api/user/product/all?page=${page}&limit=10`
        : `/api/user/product/category/${encodeURIComponent(category)}?page=${page}&limit=10`;

      const res = await api.get(url);
      if (!res.success) throw new Error('Request failed');

      // ── Raw API products, no mapping needed ───────────────────────────
      const incoming: Product[] = res.data.products ?? [];
      const pagination          = res.data.pagination ?? {};

      setProducts(prev => (reset || page === 1) ? incoming : [...prev, ...incoming]);
      setCurrentPage(pagination.currentPage ?? page);
      setHasMore(pagination.hasMore ?? false);
      setTotalProducts(pagination.totalProducts ?? 0);

      if (page === 1 && category === 'All') {
        saveToCache({ products: incoming, totalProducts: pagination.totalProducts, hasMore: pagination.hasMore, currentPage: pagination.currentPage });
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchProducts(currentPage + 1, false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await refreshCart();
    await fetchProducts(1, true);
  };

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchProducts(1, true); refreshCart(); }, []);

  useEffect(() => {
    fetchProducts(1, true, activeCategory);
  }, [activeCategory]);

  useFocusEffect(useCallback(() => {
    refreshCart(); // refresh cart badge when coming back from product/cart screen
  }, [refreshCart]));

  // ── Scroll-driven parallax (pull-to-zoom banner + fading hero text) ──
  const scrollY = useRef(new Animated.Value(0)).current;
  const bannerScale = scrollY.interpolate({ inputRange: [-250, 0], outputRange: [1.45, 1], extrapolateRight: 'clamp' });
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: 'clamp' });
  const heroShift = scrollY.interpolate({ inputRange: [0, 150], outputRange: [0, -28], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        decelerationRate="normal"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={['#0C831F']} tintColor="#0C831F" progressViewOffset={20} />
        }
      >
        {/* ── Banner + Header ─────────────────────────────────────────── */}
        <View style={styles.bannerWrap}>
          <Animated.Image
            source={require('../../assets/banner.png')}
            style={[styles.bannerImg, { transform: [{ scale: bannerScale }] }]}
            resizeMode="cover"
          />

          {/* Header sits on top of banner — transparent bg */}
          <Header
            location="Haldwani, Uttarakhand"
            onLocationPress={() => Alert.alert('Change Location')}
          />

          <Animated.View style={[styles.bannerText, { opacity: heroOpacity, transform: [{ translateY: heroShift }] }]}>
            <Text style={styles.bannerTitle}>Explore the Hills</Text>
            <Text style={styles.bannerSub}>Book rides & send parcels to hill stations</Text>
          </Animated.View>
        </View>

        {/* ── Categories ──────────────────────────────────────────────── */}
        <Categories
          activeCategory={activeCategory}
          onCategoryPress={setActiveCategory}
        />

        {/* ── Products ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Available Products</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#0C831F" />
              <Text style={styles.centerText}>Loading products…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>Something went wrong</Text>
              <Text style={styles.centerText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : products.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
              <Text style={styles.centerText}>No products available</Text>
            </View>
          ) : (
            <>
              {/* ── 2-column grid — pass raw product directly ── */}
              <View style={styles.grid}>
                {products.map(item => (
                  <ProductCard
                    key={item._id}
                    product={item}                              // ← raw API object, no mapping
                    quantity={getQuantity(item._id)}
                    onAddToCart={() => handleAddToCart(item)}
                    onUpdateQuantity={qty => handleUpdateQuantity(item._id, qty)}
                  />
                ))}
              </View>

              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? <ActivityIndicator size="small" color="#0C831F" />
                    : <Text style={styles.loadMoreText}>Load more</Text>}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* Hovering cart — appears when items are in the cart, taps through to /cart */}
      <FloatingCart />
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#F9F8F4' },
  scroll:      { flex: 1 },

  bannerWrap:  { width: '100%', height: 420, position: 'relative' },
  bannerImg:   { width: '100%', height: '100%' },
  bannerText:  { position: 'absolute', bottom: 64, left: 20, right: 20, zIndex: 10 },
  bannerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  bannerSub:   { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4, fontWeight: '500' },

  section:     { paddingHorizontal: 16, paddingTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:{ fontSize: 17, fontWeight: '700', color: '#1A3B32' },
  viewAll:     { fontSize: 13, fontWeight: '600', color: '#0C831F' },

  // 2-col grid — matches ProductCard wrapper width: '47%'
  grid:        { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  loadMoreBtn: { marginVertical: 16, backgroundColor: '#DDFBE6', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  loadMoreText:{ color: '#0C831F', fontWeight: '600', fontSize: 14 },

  center:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 8 },
  centerText:  { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  errorText:   { fontSize: 16, fontWeight: '600', color: '#EF4444' },
  retryBtn:    { marginTop: 8, backgroundColor: '#0C831F', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99 },
  retryText:   { color: '#fff', fontWeight: '600', fontSize: 14 },
});