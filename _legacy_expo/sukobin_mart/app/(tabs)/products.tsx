import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  Dimensions,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { api } from '@/service/api';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48 - 12) / 2;

// Types
interface Product {
  _id: string;
  productName: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
  isAvailable: boolean;
  ratings: number;
  totalReviews: number;
}

interface ShopData {
  id: string;
  name: string;
  totalProducts: number;
}

// Sort options
type SortKey = 'default' | 'price_asc' | 'price_desc' | 'rating' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'Default' },
  { key: 'price_asc', label: 'Price: Low–High' },
  { key: 'price_desc', label: 'Price: High–Low' },
  { key: 'rating', label: 'Top Rated' },
  { key: 'name', label: 'Name A–Z' },
];

const DEBOUNCE_DELAY = 500; // 500ms debounce

// Cross-platform shadows
const shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 4 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
    android: { elevation: 4 },
  }),
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 1 },
  }),
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [showSort, setShowSort] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce ref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const clearSearch = useCallback(() => {
    setSearchText('');
    setIsSearching(false);
  }, []);

  // Fetch products on screen focus
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoad.current) {
        fetchProducts(1, true);
        isFirstLoad.current = false;
      }
    }, [])
  );

  // Debounced search effect
  useEffect(() => {
    // Skip first render
    if (isFirstLoad.current) return;

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      if (searchText.trim().length > 0) {
        // Use search API
        searchProducts(1, true);
      } else {
        // If search is cleared, go back to normal fetch
        setIsSearching(false);
        fetchProducts(1, true);
      }
    }, DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchText]);

  const fetchProducts = async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      if (refresh) setLoading(true);
      
      const params: any = {
        page: pageNum,
        limit: 20,
        sort: sortKey === 'price_asc' || sortKey === 'price_desc' || sortKey === 'rating' || sortKey === 'name' 
          ? undefined 
          : '-createdAt',
      };

      if (activeCategory !== 'All') params.category = activeCategory;

      const response = await api.get('/api/product/my-products', { params });

      if (response.success) {
        const newProducts = response.data.products;
        if (refresh) {
          setProducts(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
        setHasMore(response.data.pagination.hasMore);
        setCategories(['All', ...response.data.categories]);
        setShopData(response.data.shop);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      if (refresh) {
        Alert.alert('Error', 'Failed to load products');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Search products using dedicated search endpoint
  const searchProducts = async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      if (refresh) {
        setLoading(true);
        setIsSearching(true);
      }
      
      const params: any = {
        q: searchText.trim(),
        page: pageNum,
        limit: 20,
      };

      if (activeCategory !== 'All') params.category = activeCategory;
      if (isSearching) params.isAvailable = undefined; // Show all products when searching

      const response = await api.get('/api/product/search', { params });

      if (response.success) {
        const newProducts = response.data.products;
        if (refresh) {
          setProducts(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
        setHasMore(response.data.pagination.hasMore);
        setCategories(['All', ...response.data.allCategories]);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error searching products:', error);
      if (refresh) {
        Alert.alert('Error', 'Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (isSearching && searchText.trim().length > 0) {
      searchProducts(1, true);
    } else {
      fetchProducts(1, true);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    if (isSearching && searchText.trim().length > 0) {
      searchProducts(page + 1);
    } else {
      fetchProducts(page + 1);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    if (isSearching && searchText.trim().length > 0) {
      searchProducts(1, true);
    } else {
      fetchProducts(1, true);
    }
  };

  // Client-side sorting for non-API sorts
  const sortedProducts = useMemo(() => {
    let list = [...products];

    switch (sortKey) {
      case 'price_asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return list.sort((a, b) => b.price - a.price);
      case 'rating':
        return list.sort((a, b) => (b.ratings || 0) - (a.ratings || 0));
      case 'name':
        return list.sort((a, b) => a.productName.localeCompare(b.productName));
      default:
        return list;
    }
  }, [products, sortKey]);

  const activeSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sort';

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: '/product-detail',
      params: { productId: product._id }
    });
  };

  // Get total count based on search state
  const totalProducts = isSearching ? products.length : (shopData?.totalProducts || 0);

  if (loading && products.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
        <Text className="mt-4 text-[#1A3D2B] font-medium">
          {isSearching ? 'Searching products...' : 'Loading products...'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />

      <View className="flex-1 px-6 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3"
              style={shadow.sm}
            >
              <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
            </TouchableOpacity>
            <View>
              <Text className="text-xl font-extrabold text-[#1A3D2B]">
                My Products
              </Text>
              {shopData && (
                <Text className="text-xs text-gray-500">{totalProducts} products</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/add-product')}
            activeOpacity={0.75}
            className="w-10 h-10 bg-[#1A3D2B] rounded-full items-center justify-center"
            style={shadow.sm}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          className={`flex-row items-center bg-white rounded-2xl px-4 mb-5 ${
            isFocused ? 'border-2 border-[#1A3D2B]' : 'border border-gray-100'
          }`}
          style={[{ height: 52 }, shadow.sm]}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={isFocused ? '#1A3D2B' : '#9CA3AF'}
          />

          <TextInput
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: '#1A3D2B',
              paddingVertical: 0,
              height: 40,
            }}
          />

          {/* Show loading indicator while searching */}
          {isSearching && searchText.length > 0 && (
            <ActivityIndicator size="small" color="#1A3D2B" style={{ marginRight: 8 }} />
          )}

          {searchText.length > 0 && (
            <TouchableOpacity onPress={clearSearch} activeOpacity={0.75} className="mr-2">
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}

          <View className="w-px h-5 bg-gray-200 mr-3" />

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowSort((v) => !v)}
            className={`w-8 h-8 rounded-lg items-center justify-center ${
              sortKey !== 'default' ? 'bg-[#1A3D2B]' : 'bg-[#F0FAF3]'
            }`}
          >
            <Ionicons
              name="options-outline"
              size={16}
              color={sortKey !== 'default' ? '#fff' : '#1A3D2B'}
            />
          </TouchableOpacity>
        </View>

        {/* Search Active Indicator */}
        {isSearching && (
          <View className="flex-row items-center mb-4 bg-[#D8F3DC] rounded-full px-4 py-2 self-start">
            <Ionicons name="search" size={14} color="#1A3D2B" />
            <Text className="text-xs font-semibold text-[#1A3D2B] ml-1">
              Searching: "{searchText}"
            </Text>
            <TouchableOpacity onPress={clearSearch} className="ml-2">
              <Ionicons name="close-circle" size={16} color="#1A3D2B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sort Dropdown */}
        {showSort && (
          <View
            className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden"
            style={shadow.md}
          >
            {SORT_OPTIONS.map((opt, idx) => (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.7}
                onPress={() => { setSortKey(opt.key); setShowSort(false); }}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  idx < SORT_OPTIONS.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    sortKey === opt.key ? 'text-[#1A3D2B]' : 'text-gray-400'
                  }`}
                >
                  {opt.label}
                </Text>
                {sortKey === opt.key && (
                  <Ionicons name="checkmark" size={16} color="#1A3D2B" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View className="bg-[#D8F3DC] p-2 rounded-lg">
              <Ionicons name="cube-outline" size={16} color="#1A3D2B" />
            </View>
            <Text className="text-sm font-medium text-[#1A3D2B] ml-2">
              {isSearching ? 'Results' : 'Total Products'}
            </Text>
            <Text className="text-base font-extrabold text-[#1A3D2B] ml-1.5">
              {totalProducts}
            </Text>
          </View>

          {sortKey !== 'default' && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setSortKey('default')}
              className="flex-row items-center bg-[#1A3D2B] rounded-full px-3 py-1"
              style={{ gap: 4 }}
            >
              <Text className="text-white text-[11px] font-semibold">
                {activeSortLabel}
              </Text>
              <Ionicons name="close" size={11} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: 8 }}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => handleCategoryChange(cat)}
                activeOpacity={0.75}
                style={{ flexShrink: 0 }}
                className={`px-4 py-2 rounded-full border ${
                  isActive ? 'bg-[#1A3D2B] border-[#1A3D2B]' : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    isActive ? 'text-white' : 'text-[#1A3D2B]'
                  }`}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Product Grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
              handleLoadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {sortedProducts.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Ionicons 
                name={isSearching ? "search-outline" : "cube-outline"} 
                size={56} 
                color="#D1D5DB" 
              />
              <Text className="text-base font-semibold text-gray-400 mt-4">
                {isSearching ? 'No results found' : 'No products yet'}
              </Text>
              <Text className="text-sm text-gray-300 mt-1 text-center px-8">
                {isSearching 
                  ? `No products matching "${searchText}"`
                  : 'Add your first product to get started'
                }
              </Text>
              {(searchText.length > 0 || activeCategory !== 'All') && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => { clearSearch(); setActiveCategory('All'); setSortKey('default'); }}
                  className="mt-5 bg-[#1A3D2B] px-6 py-2.5 rounded-full"
                >
                  <Text className="text-white text-sm font-semibold">Clear filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
              {sortedProducts.map((product) => (
                <ProductCard 
                  key={product._id} 
                  product={product} 
                  onPress={() => handleProductPress(product)}
                />
              ))}
            </View>
          )}

          {/* Loading More Indicator */}
          {loadingMore && (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#1A3D2B" />
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Product Card Component
const ProductCard = React.memo(({ product, onPress }: { product: Product; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    className="bg-white rounded-2xl overflow-hidden border border-gray-100"
    style={[{ width: CARD_W }, shadow.card]}
  >
    <View>
      {product.images && product.images.length > 0 ? (
        <Image
          source={{ uri: product.images[0] }}
          style={{ width: '100%', height: 140 }}
          resizeMode="cover"
        />
      ) : (
        <View className="w-full h-[140px] bg-gray-100 items-center justify-center">
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      )}
      
      {!product.isAvailable && (
        <View className="absolute top-2 left-2 bg-red-500 rounded-full px-2 py-0.5">
          <Text className="text-[10px] font-bold text-white">Unavailable</Text>
        </View>
      )}

      {product.ratings > 0 && (
        <View
          className="absolute top-2 right-2 flex-row items-center rounded-full px-1.5 py-0.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.93)', gap: 2 }}
        >
          <Ionicons name="star" size={10} color="#F59E0B" />
          <Text className="text-[10px] font-bold text-gray-700">
            {product.ratings.toFixed(1)}
          </Text>
        </View>
      )}
    </View>

    <View className="p-2.5">
      <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {product.category}
      </Text>
      <Text className="text-[13px] font-bold text-[#1A3D2B] mt-0.5" numberOfLines={1}>
        {product.productName}
      </Text>

      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-sm font-extrabold text-[#1A3D2B]">
          ₹{product.price}
        </Text>

        <View className="bg-[#D8F3DC] px-3 py-1 rounded-full">
          <Text className="text-[10px] font-semibold text-[#1A3D2B]">
            Stock: {product.stock}
          </Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
));