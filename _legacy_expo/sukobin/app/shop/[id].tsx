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
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '@/utils/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  green900: '#1A3D2B',
  green700: '#2D6A4F',
  green500: '#40916C',
  green400: '#52B788',
  green200: '#B7E4C7',
  green100: '#D8F3DC',
  green50:  '#F0FAF3',
  white:    '#FFFFFF',
  bg:       '#F4FBF6',
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
      <Ionicons key={i} name={i <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color={C.amber} />
    ))}
    <Text style={{ fontSize: 11, color: C.textSoft, marginLeft: 2 }}>
      {rating > 0 ? rating.toFixed(1) : 'No ratings'} · {total} review{total !== 1 ? 's' : ''}
    </Text>
  </View>
);

const StatBox = ({ value, label, icon }: { value: string | number; label: string; icon: string }) => (
  <View style={{
    flex: 1, backgroundColor: C.white, borderRadius: 16,
    padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.green200,
    shadowColor: C.green900, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  }}>
    <View style={{
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    }}>
      <Ionicons name={icon as any} size={18} color={C.green500} />
    </View>
    <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{value}</Text>
    <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 2, textAlign: 'center' }}>{label}</Text>
  </View>
);

const ProductCard = ({ item, onPress }: { item: any; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.88}
    style={{
      width: (SCREEN_WIDTH - 52) / 2,
      backgroundColor: C.white,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.green200,
      shadowColor: C.green900,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    }}
  >
    <Image
      source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x300' }}
      style={{ width: '100%', height: 140 }}
      resizeMode="cover"
    />
    {!item.isAvailable && (
      <View style={{
        position: 'absolute', top: 8, right: 8,
        backgroundColor: C.red, borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.white }}>Out of Stock</Text>
      </View>
    )}
    {item.isAvailable && (
      <View style={{
        position: 'absolute', top: 8, right: 8,
        backgroundColor: 'rgba(26,61,43,0.65)', borderRadius: 8,
        paddingHorizontal: 8, paddingVertical: 3,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.green200 }}>In Stock</Text>
      </View>
    )}
    <View style={{ padding: 12 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }} numberOfLines={1}>
        {item.productName}
      </Text>
      <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }} numberOfLines={1}>
        {item.category}
      </Text>
      <Text style={{ fontSize: 12, color: C.textMid, marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Text style={{ fontSize: 17, fontWeight: '900', color: C.green500 }}>
          ₹{item.price.toLocaleString('en-IN')}
        </Text>
        <View style={{
          backgroundColor: C.green400, borderRadius: 10,
          paddingHorizontal: 10, paddingVertical: 5,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.white }}>View</Text>
        </View>
      </View>
      <View style={{ marginTop: 6 }}>
        <StarRow rating={item.ratings} total={item.totalReviews} />
      </View>
    </View>
  </TouchableOpacity>
);

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.green100,
  }}>
    <View style={{
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center',
      marginRight: 12, flexShrink: 0,
    }}>
      <Ionicons name={icon as any} size={15} color={C.green500} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSoft, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: C.text, marginTop: 2, lineHeight: 20 }}>{value}</Text>
    </View>
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams();
  const [shop, setShop]         = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'products' | 'info'>('products');

  const slideAnim   = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadShop(); }, [id]);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0, duration: 380, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  };

  const loadShop = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/user/product/shop/${id}`);
      if (response?.success) {
        setShop(response.data.shop);
        setProducts(Array.isArray(response.data.products) ? response.data.products : []);
        setStats(response.data.stats || null);
        setTimeout(animateIn, 80);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load shop details');
    } finally {
      setLoading(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.green400} />
        <Text style={{ marginTop: 12, color: C.textSoft, fontSize: 14 }}>Loading shop…</Text>
      </View>
    );
  }

  // ── Not found ──
  if (!shop) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="storefront-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginTop: 16 }}>Shop not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20, paddingHorizontal: 28, paddingVertical: 14, backgroundColor: C.green400, borderRadius: 14 }}
        >
          <Text style={{ color: C.white, fontWeight: '700', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── Banner + Logo ── */}
        <View style={{ height: 220 }}>
          {shop.bannerImage ? (
            <Image source={{ uri: shop.bannerImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ width: '100%', height: '100%', backgroundColor: C.green200 }} />
          )}
          <LinearGradient
            colors={['rgba(26,61,43,0.55)', 'transparent', 'rgba(26,61,43,0.7)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              position: 'absolute', top: 52, left: 20,
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(26,61,43,0.6)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={20} color={C.white} />
          </TouchableOpacity>

          {/* Verified badge */}
          {shop.isVerified && (
            <View style={{
              position: 'absolute', top: 60, right: 20,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: 'rgba(26,61,43,0.7)', borderRadius: 20,
              paddingHorizontal: 10, paddingVertical: 5,
            }}>
              <Ionicons name="shield-checkmark" size={13} color={C.green400} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: C.green400 }}>Verified</Text>
            </View>
          )}

          {/* Shop name on banner */}
          <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: C.white, lineHeight: 30 }}>
              {shop.shopName}
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 3 }}>
              {shop.category}{shop.subCategory ? ` · ${shop.subCategory}` : ''}
            </Text>
          </View>
        </View>

        {/* ── Logo + quick info ── */}
        <Animated.View style={{
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          backgroundColor: C.bg,
          borderTopLeftRadius: 26, borderTopRightRadius: 26,
          marginTop: -24,
          paddingTop: 20,
        }}>
          {/* Logo row */}
          <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 18,
              borderWidth: 3, borderColor: C.white,
              overflow: 'hidden', marginTop: -50,
              shadowColor: C.green900, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
            }}>
              {shop.shopLogo ? (
                <Image source={{ uri: shop.shopLogo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="storefront" size={30} color={C.green400} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="person-outline" size={12} color={C.textSoft} />
                <Text style={{ fontSize: 12, color: C.textSoft }}>{shop.owner?.name || 'Shop Owner'}</Text>
              </View>
              <StarRow rating={shop.ratings} total={shop.totalReviews} />
            </View>
          </View>

          {/* Description */}
          {shop.description ? (
            <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
              <Text style={{ fontSize: 14, color: C.textMid, lineHeight: 22 }}>{shop.description}</Text>
            </View>
          ) : null}

          {/* ── Stats row ── */}
          {stats && (
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 22, marginTop: 18 }}>
              <StatBox value={stats.totalProducts}  label="Products"    icon="cube-outline" />
              <StatBox value={stats.totalOrders}    label="Orders"      icon="bag-outline" />
              <StatBox value={stats.activeProducts} label="Active"      icon="checkmark-circle-outline" />
              <StatBox value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'} label="Rating" icon="star-outline" />
            </View>
          )}

          {/* ── Tabs ── */}
          <View style={{
            flexDirection: 'row', marginHorizontal: 22, marginTop: 22,
            backgroundColor: C.green100, borderRadius: 14, padding: 4,
          }}>
            {(['products', 'info'] as const).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 11,
                  backgroundColor: tab === t ? C.green400 : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '800',
                  color: tab === t ? C.white : C.textMid,
                }}>
                  {t === 'products' ? `Products (${products.length})` : 'Shop Info'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Products Tab ── */}
          {tab === 'products' && (
            <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
              {products.length === 0 ? (
                <View style={{
                  padding: 32, backgroundColor: C.green50, borderRadius: 18,
                  alignItems: 'center', borderWidth: 1, borderColor: C.green200,
                  borderStyle: 'dashed',
                }}>
                  <Ionicons name="cube-outline" size={36} color={C.green200} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.textSoft, marginTop: 10 }}>No products yet</Text>
                  <Text style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>This shop hasn't listed any products</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {products.map(item => (
                    <ProductCard
                      key={item._id}
                      item={item}
                      onPress={() => router.push(`/product/${item._id}`)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── Info Tab ── */}
          {tab === 'info' && (
            <View style={{
              marginHorizontal: 22, marginTop: 18,
              backgroundColor: C.white, borderRadius: 20,
              paddingHorizontal: 16,
              borderWidth: 1, borderColor: C.green200,
              shadowColor: C.green900, shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
            }}>
              <InfoRow icon="location-outline"    label="Address"      value={shop.address?.fullAddress || '—'} />
              <InfoRow icon="call-outline"         label="Phone"        value={shop.phoneNumber || '—'} />
              <InfoRow icon="mail-outline"         label="Owner Email"  value={shop.owner?.email || '—'} />
              <InfoRow icon="grid-outline"         label="Category"     value={`${shop.category}${shop.subCategory ? ` · ${shop.subCategory}` : ''}`} />
              <InfoRow icon="calendar-outline"     label="Member Since" value={new Date(shop.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
              {shop.location?.coordinates?.length === 2 && (
                <InfoRow
                  icon="navigate-outline"
                  label="Coordinates"
                  value={`${shop.location.coordinates[1].toFixed(4)}° N, ${shop.location.coordinates[0].toFixed(4)}° E`}
                />
              )}
              {/* Last row — no bottom border */}
              <View style={{
                flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
              }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: shop.isVerified ? C.green100 : '#FFF3F3',
                  alignItems: 'center', justifyContent: 'center', marginRight: 12,
                }}>
                  <Ionicons name={shop.isVerified ? 'shield-checkmark' : 'shield-outline'} size={15} color={shop.isVerified ? C.green500 : C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.textSoft, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Verification
                  </Text>
                  <Text style={{ fontSize: 14, color: shop.isVerified ? C.green500 : C.red, marginTop: 2, fontWeight: '600' }}>
                    {shop.isVerified ? 'Verified Shop' : 'Not Verified'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={{ height: 20 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}