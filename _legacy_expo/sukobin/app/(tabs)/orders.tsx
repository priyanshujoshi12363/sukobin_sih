import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, StatusBar, Animated, RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/utils/api';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90',
  amber: '#F4A261', red: '#E63946',
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STATUS_STYLE: Record<string, { c: string; bg: string; label: string }> = {
  PENDING: { c: '#92400E', bg: '#FEF3C7', label: 'Pending' },
  PLACED: { c: '#166534', bg: '#DDFBE6', label: 'Placed' },
  ACCEPTED: { c: '#166534', bg: '#DDFBE6', label: 'Accepted' },
  PREPARING: { c: '#1E40AF', bg: '#DBEAFE', label: 'Preparing' },
  READY_FOR_PICKUP: { c: '#1E40AF', bg: '#DBEAFE', label: 'Ready' },
  PICKED: { c: '#6D28D9', bg: '#EDE9FE', label: 'Picked' },
  ON_THE_WAY: { c: '#6D28D9', bg: '#EDE9FE', label: 'On the way' },
  DELIVERED: { c: '#166534', bg: '#DDFBE6', label: 'Delivered' },
  CANCELLED: { c: '#991B1B', bg: '#FEE2E2', label: 'Cancelled' },
};

const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const OrderCard = ({ order, index }: { order: any; index: number }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 360, delay: Math.min(index, 8) * 70, useNativeDriver: true }).start();
  }, [a, index]);

  const st = STATUS_STYLE[order.orderStatus] || STATUS_STYLE.PLACED;
  const firstItem = order.items?.[0];
  const more = (order.items?.length || 0) - 1;

  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/order/[id]', params: { id: order._id } })}
        style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EFEDE6', shadowColor: C.green900, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
      >
        {/* top row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            {order.shop?.shopLogo
              ? <Image source={{ uri: order.shop.shopLogo }} style={{ width: 30, height: 30, borderRadius: 9 }} />
              : <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={15} color={C.green500} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }} numberOfLines={1}>{order.shop?.shopName || 'Store'}</Text>
              <Text style={{ fontSize: 11, color: C.textSoft }}>{order.orderId}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: st.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: st.c }}>{st.label}</Text>
          </View>
        </View>

        {/* item preview */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.green50, borderRadius: 12, padding: 8 }}>
          <Image source={{ uri: firstItem?.image || 'https://via.placeholder.com/80' }} style={{ width: 40, height: 40, borderRadius: 9, backgroundColor: C.green100 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: C.text }} numberOfLines={1}>
              {firstItem?.name}{more > 0 ? `  +${more} more` : ''}
            </Text>
            <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 1 }}>{fmtDate(order.createdAt)}</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '900', color: C.green500 }}>{inr(order.totalAmount)}</Text>
        </View>

        {/* footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name={order.orderStatus === 'DELIVERED' ? 'checkmark-done' : order.orderStatus === 'CANCELLED' ? 'close-circle' : 'time-outline'} size={13} color={C.textSoft} />
            <Text style={{ fontSize: 12, color: C.textSoft }}>{order.items?.length} item{order.items?.length > 1 ? 's' : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.green500 }}>Track</Text>
            <Ionicons name="chevron-forward" size={14} color={C.green500} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/api/order/my-orders');
      if (res?.success) setOrders(res.data?.orders || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchOrders(); }, [fetchOrders]));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.text }}>My Orders</Text>
          <Text style={{ fontSize: 13, color: C.textSoft, marginTop: 2 }}>Track and manage your orders</Text>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={C.green400} />
          </View>
        ) : orders.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 60 }}>
            <View style={{ width: 100, height: 100, borderRadius: 30, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <Ionicons name="receipt-outline" size={46} color={C.green400} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>No orders yet</Text>
            <Text style={{ fontSize: 14, color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
              When you place an order it will show up here for you to track.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/home')}
              style={{ marginTop: 24, paddingHorizontal: 30, paddingVertical: 14, backgroundColor: C.green400, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Ionicons name="storefront-outline" size={18} color={C.white} />
              <Text style={{ color: C.white, fontWeight: '800', fontSize: 15 }}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} tintColor={C.green400} colors={[C.green400]} />}
          >
            {orders.map((o, i) => <OrderCard key={o._id} order={o} index={i} />)}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
