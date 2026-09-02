import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Keyboard,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/_components/cartContext';
import api from '@/utils/api';

const { width, height } = Dimensions.get('window');
const BRAND = '#1A3B32';
const GREEN = '#0C831F';

// ── Shimmer skeleton block — a sweeping highlight over a grey base ──────────
function SkeletonBlock({ w, h, r = 8, style }: { w: number; h: number; r?: number; style?: any }) {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1150, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-w, w] });
  return (
    <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: '#ECECEA', overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.7)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

// ── One skeleton result row (mirrors the real result row layout) ───────────
function SkeletonRow({ index }: { index: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 240, delay: index * 60, useNativeDriver: true }).start();
  }, [a, index]);
  const textW = width - 130;
  return (
    <Animated.View style={[skel.row, { opacity: a }]}>
      <SkeletonBlock w={56} h={56} r={10} />
      <View style={{ flex: 1, gap: 7 }}>
        <SkeletonBlock w={textW * 0.85} h={12} r={6} />
        <SkeletonBlock w={textW * 0.4} h={9} r={5} />
        <SkeletonBlock w={textW * 0.3} h={13} r={6} />
      </View>
    </Animated.View>
  );
}

// ── Bold the part of the title that matches the query ──────────────────────
function HighlightedText({ text, query, style }: { text: string; query: string; style?: any }) {
  const q = query.trim();
  if (q.length < 2) return <Text style={style} numberOfLines={2}>{text}</Text>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <Text style={style} numberOfLines={2}>{text}</Text>;
  return (
    <Text style={style} numberOfLines={2}>
      {text.slice(0, i)}
      <Text style={{ color: GREEN, fontWeight: '800' }}>{text.slice(i, i + q.length)}</Text>
      {text.slice(i + q.length)}
    </Text>
  );
}

// ── Animated result row — staggered fade/slide entrance + press scale ──────
function ResultRow({
  item,
  index,
  query,
  onPressIn,
  onPress,
}: {
  item: any;
  index: number;
  query: string;
  onPressIn: () => void;
  onPress: (item: any) => void;
}) {
  const a = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const { getQuantity } = useCart();
  const qty = getQuantity(item._id);

  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 8) * 45,
      useNativeDriver: true,
    }).start();
  }, [a, index]);

  const pressIn = () => {
    onPressIn();
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View
      style={{
        opacity: a,
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
          { scale },
        ],
      }}
    >
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
        style={styles.resultRow}
      >
        {item.images?.[0] ? (
          <Image source={{ uri: item.images[0] }} style={styles.resultImg} resizeMode="contain" />
        ) : (
          <View style={[styles.resultImg, styles.resultImgFallback]}>
            <Ionicons name="image-outline" size={24} color="#D1D5DB" />
          </View>
        )}
        <View style={styles.resultInfo}>
          <HighlightedText text={item.productName} query={query} style={styles.resultName} />
          <Text style={styles.resultCat}>{item.category}</Text>
          {item.shop && (
            <Text style={styles.resultShop} numberOfLines={1}>{item.shop.shopName}</Text>
          )}
          <View style={styles.resultPriceRow}>
            <Text style={styles.resultPrice}>₹{item.price}</Text>
            {qty > 0 ? (
              <View style={styles.inCartPill}>
                <Ionicons name="checkmark-circle" size={11} color={GREEN} />
                <Text style={styles.inCartText}>{qty} in cart</Text>
              </View>
            ) : item.stock > 0 ? (
              <View style={styles.inStock}>
                <View style={styles.stockDot} />
                <Text style={styles.stockLabel}>In stock</Text>
              </View>
            ) : (
              <Text style={styles.outOfStock}>Out of stock</Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
      </TouchableOpacity>
    </Animated.View>
  );
}

interface HeaderProps {
  location?: string;
  onLocationPress?: () => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
}

interface SearchProduct {
  _id: string;
  productName: string;
  description: string;
  category: string;
  images: string[];
  price: number;
  stock: number;
  shop?: { shopName: string };
}

const PLACEHOLDERS = [
  'Search "LED Bulb 30W"',
  'Search "ESP32"',
  'Search "groceries"',
  'Search "electronics"',
  'Search "medicine delivery"',
];

export default function Header({
  location = 'Select location',
  onLocationPress,
  onSearchFocus,
  onSearchBlur,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const [isSearchFocused, setIsSearchFocused]   = useState(false);
  const [searchText, setSearchText]             = useState('');
  const [searchResults, setSearchResults]       = useState<SearchProduct[]>([]);
  const [categories, setCategories]             = useState<string[]>([]);
  const [isSearching, setIsSearching]           = useState(false);
  const [recentSearches, setRecentSearches]     = useState<string[]>([]);
  const [totalResults, setTotalResults]         = useState(0);
  const [placeholderIdx, setPlaceholderIdx]     = useState(0);
  const [shownPlaceholder, setShownPlaceholder] = useState(PLACEHOLDERS[0]);
  const phAnim = useRef(new Animated.Value(1)).current;

  // ── This flag stops onBlur from closing the dropdown while a result tap
  // registers. Set to true on onPressIn, checked in handleBlur.
  const tappingResult = useRef(false);
  const searchInputRef = useRef<TextInput>(null);

  const backdropAnim  = useRef(new Animated.Value(0)).current;
  const dropdownAnim  = useRef(new Animated.Value(0)).current;

  // ── Load recent searches ───────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('recentSearches').then(raw => {
      if (raw) setRecentSearches(JSON.parse(raw));
    });
  }, []);

  // ── Rotate placeholder when not focused ───────────────────────────────
  useEffect(() => {
    if (isSearchFocused) return;
    const id = setInterval(
      () => setPlaceholderIdx(p => (p + 1) % PLACEHOLDERS.length),
      2500
    );
    return () => clearInterval(id);
  }, [isSearchFocused]);

  // ── Cross-fade the rotating placeholder text ──────────────────────────
  useEffect(() => {
    if (isSearchFocused || searchText.length > 0) return;
    Animated.timing(phAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShownPlaceholder(PLACEHOLDERS[placeholderIdx]);
      Animated.timing(phAnim, { toValue: 1, duration: 230, useNativeDriver: true }).start();
    });
  }, [placeholderIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced search ───────────────────────────────────────────────────
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setCategories([]);
      setTotalResults(0);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(
        `/api/user/product/search?q=${encodeURIComponent(query.trim())}`
      );
      if (res.success) {
        setSearchResults(res.data.products   ?? []);
        setCategories(res.data.categories    ?? []);
        setTotalResults(res.data.totalResults ?? 0);
      }
    } catch {
      setSearchResults([]);
      setCategories([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => performSearch(searchText), 400);
    return () => clearTimeout(t);
  }, [searchText, performSearch]);

  // ── Animation helpers ──────────────────────────────────────────────────
  const animateOpen = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(dropdownAnim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
    ]).start();
  };

  const animateClose = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(dropdownAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(cb);
  };

  // ── Focus / blur ───────────────────────────────────────────────────────
  const handleFocus = () => {
    setIsSearchFocused(true);
    onSearchFocus?.();
    animateOpen();
  };


  const dismiss = () => {
    tappingResult.current = false;
    Keyboard.dismiss();
    setIsSearchFocused(false);
    onSearchBlur?.();
    animateClose(() => {
      setSearchText('');
      setSearchResults([]);
      setTotalResults(0);
    });
  };

  // ── Recent searches helpers ────────────────────────────────────────────
  const saveRecentSearch = async (query: string) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    await AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const removeRecent = async (query: string) => {
    const updated = recentSearches.filter(s => s !== query);
    setRecentSearches(updated);
    await AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const clearAllRecent = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recentSearches');
  };

  // ── KEY FIX: Navigate to product ──────────────────────────────────────
  // Use onPressIn on each result row to set tappingResult=true BEFORE
  // TextInput's onBlur fires. Then navigate in onPress after blur has been
  // suppressed. This eliminates the race condition entirely.
  const handleResultPressIn = () => {
    tappingResult.current = true;
  };
const handleResultPress = async (product: SearchProduct) => {
  const q = searchText.trim();
  if (q.length >= 2) saveRecentSearch(q);

  setIsSearchFocused(false);

  Keyboard.dismiss();

  setSearchText("");

  setSearchResults([]);

  setCategories([]);

  setTotalResults(0);

  router.push(`/product/${product._id}`);
};

  const handleRecentPress = (query: string) => {
    setSearchText(query);
    performSearch(query);
  };

  const handleCategoryPress = (cat: string) => {
    setSearchText(cat);
    performSearch(cat);
    searchInputRef.current?.focus();
  };

  // ── Render: suggestions (no query yet) ────────────────────────────────
  const renderSuggestions = () => (
    <View style={styles.ddPad}>
      {recentSearches.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Recent</Text>
            <TouchableOpacity onPress={clearAllRecent}>
              <Text style={styles.clearAll}>Clear all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {recentSearches.map(q => (
              <TouchableOpacity
                key={q}
                onPressIn={handleResultPressIn}
                onPress={() => handleRecentPress(q)}
                style={styles.recentChip}
              >
                <Ionicons name="time-outline" size={12} color={GREEN} />
                <Text style={styles.recentChipText}>{q}</Text>
                <TouchableOpacity
                  onPress={() => removeRecent(q)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {categories.length > 0 && (
        <View>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionLabel}>Categories</Text>
          </View>
          <View style={styles.chipRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                onPressIn={handleResultPressIn}
                onPress={() => handleCategoryPress(cat)}
                style={styles.catChip}
              >
                <Text style={styles.catChipText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {recentSearches.length === 0 && categories.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Start typing to search</Text>
        </View>
      )}
    </View>
  );

  // ── Render: result rows ────────────────────────────────────────────────
  const renderResults = () => (
    <ScrollView
      keyboardShouldPersistTaps="handled"  // KEY: lets taps on results fire
      showsVerticalScrollIndicator={false}
      style={{ maxHeight: height * 0.5 }}
      contentContainerStyle={{ paddingVertical: 6 }}
    >
      {searchResults.map((item, index) => (
        <ResultRow
          key={item._id}
          item={item}
          index={index}
          query={searchText}
          onPressIn={handleResultPressIn}
          onPress={handleResultPress}
        />
      ))}
    </ScrollView>
  );

  // ── Top padding: safe area on iOS, StatusBar height on Android ─────────
  const topPad = Platform.OS === 'ios'
    ? insets.top + 8
    : (StatusBar.currentHeight ?? 0) + 10;

  return (
    <View style={[styles.root, { width }]}>
      {/* ── Header bar ───────────────────────────────────────────────── */}
      <View style={[styles.headerBg, { paddingTop: topPad }]}>
        <View style={styles.headerInner}>
          {/* Location */}
          <TouchableOpacity
            onPress={onLocationPress}
            activeOpacity={0.8}
            style={styles.locRow}
          >
            <Text style={styles.locLabel}>Delivering to</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLocationPress}
            activeOpacity={0.8}
            style={styles.locPill}
          >
            <Ionicons name="location-sharp" size={14} color="#fff" />
            <Text style={styles.locName} numberOfLines={1}>{location}</Text>
          </TouchableOpacity>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={isSearchFocused ? GREEN : BRAND}
            />
            <View style={styles.inputWrap}>
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={isSearchFocused ? 'Search for products...' : ''}
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={t => setSearchText(t.slice(0, 100))}
                onFocus={handleFocus}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={() => {
                  const q = searchText.trim();
                  if (q.length >= 2) saveRecentSearch(q);
                  performSearch(searchText);
                }}
              />
              {/* Animated rotating placeholder (only when empty + unfocused) */}
              {!isSearchFocused && searchText.length === 0 && (
                <Animated.Text
                  numberOfLines={1}
                  pointerEvents="none"
                  style={[
                    styles.phOverlay,
                    {
                      opacity: phAnim,
                      transform: [{ translateY: phAnim.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
                    },
                  ]}
                >
                  {shownPlaceholder}
                </Animated.Text>
              )}
            </View>
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchText('');
                  setSearchResults([]);
                  searchInputRef.current?.focus();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.clearBtn}
              >
                <Ionicons name="close" size={14} color="#4B5563" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      {isSearchFocused && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="box-only"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={dismiss}
            
          />
        </Animated.View>
      )}

      {/* ── Dropdown ─────────────────────────────────────────────────── */}
      {isSearchFocused && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              opacity: dropdownAnim,
              transform: [{
                translateY: dropdownAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              }],
            },
          ]}
        >
          {isSearching ? (
            <View style={{ paddingVertical: 6 }}>
              {[0, 1, 2, 3].map(i => <SkeletonRow key={i} index={i} />)}
            </View>
          ) : searchText.length < 2 ? (
            renderSuggestions()
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term</Text>
            </View>
          ) : (
            <>
              {/* Result count header */}
              <View style={styles.resultCountRow}>
                <Text style={styles.resultCountLabel}>
                  {totalResults} result{totalResults !== 1 ? 's' : ''}
                </Text>
                <Text style={styles.resultCountQuery}>
                  for "{searchText}"
                </Text>
              </View>
              {renderResults()}
            </>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 50,
  },
  headerInner: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  locLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  locName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  inputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    padding: 0,        // Android needs this to kill default padding
    margin: 0,
  },
  phOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    fontSize: 14,
    lineHeight: 18,
    color: '#9CA3AF',
    textAlignVertical: 'center',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0F0EE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Backdrop — zIndex ABOVE header so taps register
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 40,
  },

  // Dropdown
  dropdown: {
    position: 'absolute',
    top: '100%',       // sits directly below the header bar
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    zIndex: 60,        // above backdrop
    overflow: 'hidden',
    marginTop: 8,
    // native shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 14,
  },

  // Suggestions
  ddPad: { padding: 16 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#9CA3AF',
  },
  clearAll: {
    fontSize: 11,
    fontWeight: '600',
    color: GREEN,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F3',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  catChip: {
    backgroundColor: '#DDFBE6',
    borderWidth: 0.5,
    borderColor: '#BBF7D0',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },

  // Result count header
  resultCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  resultCountLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#6B7280',
  },
  resultCountQuery: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Result rows
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F9F9F9',
  },
  resultImg: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F0F0EE',
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    lineHeight: 18,
  },
  resultCat: {
    fontSize: 10,
    color: GREEN,
    fontWeight: '500',
    marginTop: 1,
  },
  resultShop: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  resultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND,
  },
  inStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: GREEN,
  },
  stockLabel: {
    fontSize: 10,
    color: GREEN,
    fontWeight: '600',
  },
  outOfStock: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
  },
  inCartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DDFBE6',
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  inCartText: {
    fontSize: 10,
    color: GREEN,
    fontWeight: '700',
  },

  // States
  loadingState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resultImgFallback: {
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F0F0EE',
},
});

// ── Skeleton row layout (mirrors resultRow spacing) ────────────────────────
const skel = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});