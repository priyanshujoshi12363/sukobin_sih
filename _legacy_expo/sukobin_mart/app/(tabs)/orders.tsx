import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Animated, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';

const C = {
  green900: '#1A3D2B', green700: '#2D6A4F', green500: '#40916C', green400: '#52B788', green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', amber: '#F4A261', red: '#E63946', border: '#EFEDE6',
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = (d: string) => { try { return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const TABS = [
  { key: 'new', label: 'New', q: 'PLACED' },
  { key: 'preparing', label: 'Preparing', q: 'ACCEPTED,PREPARING' },
  { key: 'ready', label: 'Ready', q: 'READY_FOR_PICKUP' },
  { key: 'out', label: 'Out', q: 'PICKED,ON_THE_WAY,DELIVERED' },
  { key: 'cancelled', label: 'Cancelled', q: 'CANCELLED' },
];

const BADGE: Record<string, { c: string; bg: string; label: string }> = {
  PLACED: { c: '#92400E', bg: '#FEF3C7', label: 'New' },
  ACCEPTED: { c: '#166534', bg: '#D8F3DC', label: 'Accepted' },
  PREPARING: { c: '#1E40AF', bg: '#DBEAFE', label: 'Preparing' },
  READY_FOR_PICKUP: { c: '#6D28D9', bg: '#EDE9FE', label: 'Ready' },
  PICKED: { c: '#6D28D9', bg: '#EDE9FE', label: 'Picked' },
  ON_THE_WAY: { c: '#6D28D9', bg: '#EDE9FE', label: 'On the way' },
  DELIVERED: { c: '#166534', bg: '#D8F3DC', label: 'Delivered' },
  CANCELLED: { c: '#991B1B', bg: '#FEE2E2', label: 'Cancelled' },
};

const OrderCard = ({ order, index, onAction }: any) => {
  const a = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 320, delay: Math.min(index, 8) * 60, useNativeDriver: true }).start(); }, []);

  const st = BADGE[order.orderStatus] || BADGE.PLACED;
  const first = order.items?.[0];
  const more = (order.items?.length || 0) - 1;

  const act = async (status: string, label: string) => {
    setBusy(true);
    await onAction(order._id, status, label);
    setBusy(false);
  };

  let primary: any = null, secondary: any = null;
  if (order.orderStatus === 'PLACED') {
    primary = { status: 'ACCEPTED', label: 'Accept', icon: 'checkmark-circle' };
    secondary = { status: 'CANCELLED', label: 'Reject', icon: 'close' };
  } else if (order.orderStatus === 'ACCEPTED') {
    primary = { status: 'PREPARING', label: 'Start Preparing', icon: 'cube' };
    secondary = { status: 'CANCELLED', label: 'Cancel', icon: 'close' };
  } else if (order.orderStatus === 'PREPARING') {
    primary = { status: 'READY_FOR_PICKUP', label: 'Mark Ready', icon: 'bag-check' };
  }

  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push({ pathname: '/order-detail', params: { id: order._id } })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14.5, fontWeight: '900', color: C.text }}>{order.orderId}</Text>
              <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 1 }}>{fmt(order.createdAt)}</Text>
            </View>
            <View style={{ backgroundColor: st.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: st.c }}>{st.label}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, backgroundColor: C.green50, borderRadius: 12, padding: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }} numberOfLines={1}>
                {first?.name}{more > 0 ? `  +${more} more` : ''}
              </Text>
              <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 1 }}>{order.totalItems} item{order.totalItems > 1 ? 's' : ''} · 📞 {order.customerPhone}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: C.green500 }}>{inr(order.totalAmount)}</Text>
          </View>
        </TouchableOpacity>

        {(primary || secondary) && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {secondary && (
              <TouchableOpacity onPress={() => act(secondary.status, secondary.label)} disabled={busy}
                style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: C.red, backgroundColor: '#FFF5F5', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name={secondary.icon} size={15} color={C.red} />
                <Text style={{ color: C.red, fontWeight: '800', fontSize: 13 }}>{secondary.label}</Text>
              </TouchableOpacity>
            )}
            {primary && (
              <TouchableOpacity onPress={() => act(primary.status, primary.label)} disabled={busy}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: C.green500, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name={primary.icon} size={16} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 13.5 }}>{primary.label}</Text></>}
              </TouchableOpacity>
            )}
          </View>
        )}
        {order.orderStatus === 'READY_FOR_PICKUP' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#EDE9FE', borderRadius: 12, padding: 10 }}>
            <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#6D28D9" />
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#6D28D9' }}>Packed — waiting for a delivery partner</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

export default function OrdersScreen() {
  const [tab, setTab] = useState('new');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async (key = tab) => {
    const q = TABS.find((t) => t.key === key)?.q;
    try {
      const res = await api.get('/api/merchant/orders', { params: { status: q, limit: 50 } });
      if (res?.success) setOrders(res.data?.orders || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchOrders(tab); }, [tab]));

  const onAction = async (id: string, status: string, label: string) => {
    const run = async () => {
      try {
        const res = await api.patch(`/api/merchant/orders/${id}/status`, { status });
        if (res?.success) fetchOrders(tab);
        else Alert.alert('Error', res?.message || 'Could not update order');
      } catch { Alert.alert('Error', 'Something went wrong'); }
    };
    if (status === 'CANCELLED') {
      Alert.alert(`${label} order?`, 'The customer will be refunded if they paid.', [
        { text: 'No', style: 'cancel' },
        { text: `Yes, ${label}`, style: 'destructive', onPress: run },
      ]);
    } else { await run(); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: C.text }}>Orders</Text>
          <Text style={{ fontSize: 13, color: C.textSoft }}>Accept, pack & hand off to delivery</Text>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 46, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
                style={{ paddingHorizontal: 16, height: 36, borderRadius: 99, backgroundColor: active ? C.green500 : C.white, borderWidth: 1, borderColor: active ? C.green500 : C.border, justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: active ? '#fff' : C.textMid }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={C.green500} /></View>
        ) : orders.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 }}>
            <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="receipt-outline" size={42} color={C.green500} />
            </View>
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} orders</Text>
            <Text style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>New orders will appear here instantly</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(tab); }} tintColor={C.green500} colors={[C.green500]} />}>
            {orders.map((o, i) => <OrderCard key={o._id} order={o} index={i} onAction={onAction} />)}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
