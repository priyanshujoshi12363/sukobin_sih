import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import api from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCart } from '@/_components/cartContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const C = {
  // Leaf green palette
  green900: '#1A3D2B',   // dark forest — headings, icons
  green700: '#2D6A4F',   // medium — secondary text
  green500: '#40916C',   // mid green — accents
  green400: '#48be52',   // leaf green — primary accent / CTAs
  green200: '#B7E4C7',   // soft mint — borders, dividers
  green100: '#D8F3DC',   // pale mint — backgrounds
  green50:  '#F0FAF3',   // near-white green — card bg

  white:    '#FFFFFF',
  bg:       '#F4FBF6',   // whole screen bg — very light green
  text:     '#1A3D2B',
  textMid:  '#4A7560',
  textSoft: '#7DAA90',
  amber:    '#F4A261',
  red:      '#E63946',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const StarRow = ({ rating, total }: { rating: number; total: number }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    {[1,2,3,4,5].map(i => (
      <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={13} color={C.amber} />
    ))}
    <Text style={{ fontSize: 12, color: C.textSoft, marginLeft: 3 }}>
      {rating > 0 ? rating.toFixed(1) : 'No ratings'} · {total} review{total !== 1 ? 's' : ''}
    </Text>
  </View>
);

const Badge = ({ label, icon }: { label: string; icon?: string }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green100, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, gap: 4,
  }}>
    {icon && <Ionicons name={icon as any} size={12} color={C.green400} />}
    <Text style={{ fontSize: 11, fontWeight: '700', color: C.green500, letterSpacing: 0.6 }}>
      {label.toUpperCase()}
    </Text>
  </View>
);

const StockPulse = ({ stock, isAvailable }: { stock: number; isAvailable: boolean }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isAvailable) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [isAvailable]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{
          position: 'absolute', width: 14, height: 14, borderRadius: 7,
          backgroundColor: isAvailable ? C.green400 + '35' : C.red + '35',
          transform: [{ scale: pulse }],
        }} />
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isAvailable ? C.green400 : C.red }} />
      </View>
      <Text style={{ fontSize: 13, color: isAvailable ? C.green500 : C.red, fontWeight: '600' }}>
        {isAvailable ? `${stock} in stock` : 'Out of stock'}
      </Text>
    </View>
  );
};

// ─── Product Card (used in both Related & Shop sections) ──────────────────────
const ProductCard = ({ item, shopName, onPress }: { item: any; shopName?: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{
    width: 152, backgroundColor: C.white, borderRadius: 18,
    overflow: 'hidden', marginRight: 12,
    borderWidth: 1, borderColor: C.green200,
    shadowColor: C.green900, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  }}>
    <Image
      source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x300' }}
      style={{ width: '100%', height: 114 }} resizeMode="cover"
    />
    <View style={{ padding: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }} numberOfLines={1}>
        {item.productName}
      </Text>
      {shopName && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <Ionicons name="storefront-outline" size={10} color={C.textSoft} />
          <Text style={{ fontSize: 11, color: C.textSoft }} numberOfLines={1}>{shopName}</Text>
        </View>
      )}
      <Text style={{ fontSize: 11, color: C.textMid, marginTop: 1 }} numberOfLines={1}>
        {item.category}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '900', color: C.green500 }}>₹{item.price}</Text>
        {item.isAvailable && (
          <View style={{ backgroundColor: C.green100, borderRadius: 8, padding: 4 }}>
            <Ionicons name="add" size={13} color={C.green400} />
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
);

// ─── Shop Banner Card ─────────────────────────────────────────────────────────
const ShopCard = ({ shop, onPress }: { shop: any; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{
    marginTop: 20, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: C.green200,
    shadowColor: C.green900, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  }}>
    {/* Banner */}
    {shop.bannerImage ? (
      <Image source={{ uri: shop.bannerImage }} style={{ width: '100%', height: 80 }} resizeMode="cover" />
    ) : (
      <View style={{ width: '100%', height: 80, backgroundColor: C.green100 }} />
    )}
    {/* Overlay gradient on banner */}
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(26,61,43,0.35)' }} />

    {/* Info row */}
    <View style={{ backgroundColor: C.white, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
      {/* Logo overlapping banner */}
      <View style={{
        width: 52, height: 52, borderRadius: 14,
        borderWidth: 3, borderColor: C.white,
        overflow: 'hidden', marginTop: -28,
        shadowColor: C.green900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
      }}>
        {shop.shopLogo ? (
          <Image source={{ uri: shop.shopLogo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="storefront" size={24} color={C.green400} />
          </View>
        )}
      </View>

      <View style={{ flex: 1, marginLeft: 12, marginTop: -6 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{shop.shopName}</Text>
        <Text style={{ fontSize: 12, color: C.textSoft, marginTop: 1 }}>
          {shop.category}{shop.subCategory ? ` · ${shop.subCategory}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="cube-outline" size={11} color={C.textSoft} />
            <Text style={{ fontSize: 11, color: C.textSoft }}>{shop.totalProducts} products</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="call-outline" size={11} color={C.textSoft} />
            <Text style={{ fontSize: 11, color: C.textSoft }}>{shop.phoneNumber}</Text>
          </View>
        </View>
      </View>

      <View style={{
        backgroundColor: C.green400, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
      }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: C.white }}>Visit</Text>
        <Ionicons name="arrow-forward" size={12} color={C.white} />
      </View>
    </View>

    {/* Address */}
    {shop.address?.fullAddress && (
      <View style={{
        backgroundColor: C.green50, paddingHorizontal: 14, paddingVertical: 8,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <Ionicons name="location-outline" size={13} color={C.textSoft} />
        <Text style={{ fontSize: 11, color: C.textSoft, flex: 1 }} numberOfLines={1}>
          {shop.address.fullAddress}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
    <View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 12, color: C.textSoft, marginTop: 1 }}>{subtitle}</Text>}
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: C.green400 }}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct]           = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [shopDetails, setShopDetails]   = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [quantity, setQuantity]         = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [wishlisted, setWishlisted]     = useState(false);

  // Shared cart context — single source of truth across home / search / detail
  const { addToCart, updateQuantity, removeFromCart, getQuantity, totalItems } = useCart();

  const slideAnim   = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadProductDetails(); }, [id]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const loadProductDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/user/product/${id}`);
      if (response?.success) {
        setProduct(response.data?.product || null);
        setRelatedProducts(Array.isArray(response.data?.relatedProducts) ? response.data.relatedProducts : []);
        setShopProducts(Array.isArray(response.data?.shopProducts) ? response.data.shopProducts : []);
        setShopDetails(response.data?.shopDetails || null);
        setTimeout(animateIn, 80);
      }
    } catch {
      Alert.alert('Error', 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  };

  // Add the selected quantity to the cart via shared context (no duplicate lines —
  // the context/backend merge by product). Once in cart, the CTA switches to a
  // stepper + "Go to Cart", so the user can't keep stacking blind adds.
  const handleAddToCart = async () => {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      Alert.alert('Login Required', 'Please login to add items to cart', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/login') },
      ]);
      return;
    }
    setAddingToCart(true);
    await addToCart(product, quantity);
    setAddingToCart(false);
  };

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.green400} />
        <Text style={{ marginTop: 12, color: C.textSoft, fontSize: 14 }}>Loading product…</Text>
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginTop: 16 }}>Product not found</Text>
        <Text style={{ color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          This product may have been removed or is no longer available.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 24, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: C.green400, borderRadius: 14 }}
        >
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const productImage = product.images?.[0] || 'https://via.placeholder.com/400x300';
  // shop name from nested product.shop object or from shopDetails
  const shopName     = shopDetails?.shopName || product.shop?.shopName || '';

  // ── Cart state for THIS product (from shared context) ──
  const cartQty   = getQuantity(product._id);
  const inCart    = cartQty > 0;
  const lineQty   = inCart ? cartQty : quantity;                 // qty shown in bottom bar
  const lineTotal = (product.price * lineQty).toLocaleString('en-IN');

  const incCart = () => { if (cartQty < product.stock) updateQuantity(product._id, cartQty + 1); };
  const decCart = () => { if (cartQty <= 1) removeFromCart(product._id); else updateQuantity(product._id, cartQty - 1); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }} bounces>

        {/* ── Hero Image ── */}
        <View>
          <Image
            source={{ uri: productImage }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.44 }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(26,61,43,0.55)', 'transparent', 'rgba(26,61,43,0.1)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Top bar */}
          <View style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20,
          }}>
            <TouchableOpacity onPress={() => router.back()} style={heroBtn}>
              <Ionicons name="arrow-back" size={20} color={C.white} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => setWishlisted(w => !w)} style={heroBtn}>
                <Ionicons name={wishlisted ? 'heart' : 'heart-outline'} size={20} color={wishlisted ? '#FF6B6B' : C.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/cart')} style={heroBtn}>
                <Ionicons name="cart-outline" size={20} color={C.white} />
                {totalItems > 0 && (
                  <View style={cartBadge}>
                    <Text style={cartBadgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          {/* Shop name pill floating on image bottom */}
          {shopName ? (
            <View style={{
              position: 'absolute', bottom: 16, left: 20,
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: 'rgba(26,61,43,0.75)', borderRadius: 20,
              paddingHorizontal: 12, paddingVertical: 6,
            }}>
              {shopDetails?.shopLogo ? (
                <Image source={{ uri: shopDetails.shopLogo }} style={{ width: 20, height: 20, borderRadius: 10 }} />
              ) : (
                <Ionicons name="storefront-outline" size={13} color={C.green200} />
              )}
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.white }}>{shopName}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Sheet card ── */}
        <Animated.View style={{
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          backgroundColor: C.bg,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          marginTop: -26,
          paddingHorizontal: 22, paddingTop: 24,
        }}>

          {/* Category + Stock */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge label={product.category} icon="pricetag-outline" />
            <StockPulse stock={product.stock} isAvailable={product.isAvailable} />
          </View>

          {/* Name */}
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.text, marginTop: 14, lineHeight: 32 }}>
            {product.productName}
          </Text>

          {/* Price */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 3 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.green500 }}>₹</Text>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.green500, letterSpacing: -1 }}>
              {product.price.toLocaleString('en-IN')}
            </Text>
            <Text style={{ fontSize: 13, color: C.textSoft, marginLeft: 4 }}>/ unit</Text>
          </View>

          {/* Stars */}
          <View style={{ marginTop: 8 }}>
            <StarRow rating={product.ratings} total={product.totalReviews} />
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: C.green200, marginVertical: 18 }} />

          {/* Description */}
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase' }}>
            About this product
          </Text>
          <Text style={{ fontSize: 15, color: C.textMid, lineHeight: 24, marginTop: 8 }}>
            {product.description}
          </Text>

          {/* Trust chips */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Genuine' },
              { icon: 'return-up-back-outline',   label: 'Easy Returns' },
              { icon: 'flash-outline',             label: 'Fast Delivery' },
            ].map(c => (
              <View key={c.label} style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: C.green100, borderRadius: 20,
                paddingHorizontal: 12, paddingVertical: 6,
              }}>
                <Ionicons name={c.icon as any} size={13} color={C.green500} />
                <Text style={{ fontSize: 12, color: C.green700, fontWeight: '600' }}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* ── Shop Card ── */}
          {shopDetails && (
            <>
              <View style={{ height: 1, backgroundColor: C.green200, marginTop: 24, marginBottom: 4 }} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase', marginTop: 14 }}>
                Sold by
              </Text>
              <ShopCard
                shop={shopDetails}
                onPress={() => shopDetails._id && router.push(`/shop/${shopDetails._id}`)}
              />
            </>
          )}

          {/* ── More from this Shop ── */}
          {shopProducts.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader
                title={`More from ${shopName || 'this shop'}`}
                subtitle={`${shopProducts.length} other product${shopProducts.length > 1 ? 's' : ''} available`}
                onSeeAll={() => shopDetails?._id && router.push(`/shop/${shopDetails._id}`)}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {shopProducts.map((item: any) => (
                  <ProductCard
                    key={item._id}
                    item={item}
                    shopName={shopName}
                    onPress={() => router.push(`/product/${item._id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Related Products ── */}
          {relatedProducts.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader
                title="Related Products"
                subtitle="You might also like"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {relatedProducts.map((item: any) => (
                  <ProductCard
                    key={item._id}
                    item={item}
                    shopName={item.shop?.shopName}
                    onPress={() => router.push(`/product/${item._id}`)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Empty state for related if both empty */}
          {relatedProducts.length === 0 && shopProducts.length === 0 && (
            <View style={{
              marginTop: 24, padding: 20, backgroundColor: C.green50,
              borderRadius: 16, alignItems: 'center',
              borderWidth: 1, borderColor: C.green200, borderStyle: 'dashed',
            }}>
              <Ionicons name="grid-outline" size={28} color={C.green200} />
              <Text style={{ fontSize: 13, color: C.textSoft, marginTop: 8 }}>No related products yet</Text>
            </View>
          )}

        </Animated.View>
      </ScrollView>

      {/* ── Sticky Bottom Bar ── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: C.white,
        borderTopWidth: 1, borderTopColor: C.green200,
        paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30,
        shadowColor: C.green900, shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 14,
      }}>
        {/* Qty + total — stepper controls the picked qty before adding,
            and the actual cart line once the item is in the cart */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: C.green50, borderRadius: 14,
            borderWidth: 1, borderColor: inCart ? C.green400 : C.green200, overflow: 'hidden',
          }}>
            <TouchableOpacity
              onPress={inCart ? decCart : () => setQuantity(Math.max(1, quantity - 1))}
              style={{ paddingHorizontal: 16, paddingVertical: 10 }}
            >
              <Ionicons
                name={inCart && cartQty <= 1 ? 'trash-outline' : 'remove'}
                size={18}
                color={inCart && cartQty <= 1 ? C.red : C.green900}
              />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.green900, minWidth: 32, textAlign: 'center' }}>
              {lineQty}
            </Text>
            <TouchableOpacity
              onPress={inCart ? incCart : () => setQuantity(Math.min(product.stock, quantity + 1))}
              disabled={lineQty >= product.stock}
              style={{ paddingHorizontal: 16, paddingVertical: 10, opacity: lineQty >= product.stock ? 0.35 : 1 }}
            >
              <Ionicons name="add" size={18} color={C.green900} />
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: inCart ? C.green500 : C.textSoft, fontWeight: '700', letterSpacing: 0.5 }}>
              {inCart ? 'IN YOUR CART' : 'TOTAL'}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.green900 }}>₹{lineTotal}</Text>
          </View>
        </View>

        {/* Single primary action — switches to "Go to Cart" once added (no duplicates) */}
        {inCart ? (
          <TouchableOpacity
            onPress={() => router.push('/cart')}
            activeOpacity={0.9}
            style={{
              paddingVertical: 16, borderRadius: 16, backgroundColor: C.green400,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              shadowColor: C.green700, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
            }}
          >
            <Ionicons name="checkmark-circle" size={18} color={C.white} />
            <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>Added · Go to Cart</Text>
            <Ionicons name="arrow-forward" size={16} color={C.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleAddToCart}
            disabled={addingToCart || !product.isAvailable}
            activeOpacity={0.9}
            style={{
              paddingVertical: 16, borderRadius: 16,
              backgroundColor: product.isAvailable ? C.green400 : C.green200,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: !product.isAvailable ? 0.7 : 1,
              shadowColor: C.green700, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
            }}
          >
            {addingToCart
              ? <ActivityIndicator size="small" color={C.white} />
              : (
                <>
                  <Ionicons name={product.isAvailable ? 'cart' : 'close-circle'} size={18} color={C.white} />
                  <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>
                    {product.isAvailable ? 'Add to Cart' : 'Out of Stock'}
                  </Text>
                </>
              )
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const heroBtn = {
  width: 42, height: 42, borderRadius: 21,
  backgroundColor: 'rgba(26,61,43,0.55)',
  alignItems: 'center' as const, justifyContent: 'center' as const,
};

const cartBadge = {
  position: 'absolute' as const, top: -4, right: -4,
  minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
  backgroundColor: C.amber,
  alignItems: 'center' as const, justifyContent: 'center' as const,
  borderWidth: 1.5, borderColor: 'rgba(26,61,43,0.55)',
};

const cartBadgeText = { fontSize: 9, fontWeight: '900' as const, color: C.green900 };