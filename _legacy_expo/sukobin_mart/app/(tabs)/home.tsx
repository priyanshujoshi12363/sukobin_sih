import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/service/api';

const C = {
  green900: '#1A3D2B', green700: '#2D6A4F', green500: '#40916C', green400: '#52B788', green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', amber: '#F4A261', red: '#E63946', border: '#EFEDE6', blue: '#3B82F6',
};
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Tile = ({ icon, lib: Lib = Ionicons, label, value, tint }: any) => (
  <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border }}>
    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: tint + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}>
      <Lib name={icon} size={18} color={tint} />
    </View>
    <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{value}</Text>
    <Text style={{ fontSize: 11.5, color: C.textSoft, fontWeight: '600' }}>{label}</Text>
  </View>
);

const QuickAction = ({ icon, lib: Lib = Ionicons, label, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1, alignItems: 'center', gap: 7 }}>
    <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.green100 }}>
      <Lib name={icon} size={23} color={C.green500} />
    </View>
    <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.textMid }}>{label}</Text>
  </TouchableOpacity>
);

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [newOrders, setNewOrders] = useState<any[]>([]);
  const [shopName, setShopName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('merchantData');
      if (raw) { const m = JSON.parse(raw); setShopName(m.businessName || m.name || 'your store'); }
      const [s, o] = await Promise.all([
        api.get('/api/merchant/stats'),
        api.get('/api/merchant/orders', { params: { status: 'PLACED', limit: 3 } }),
      ]);
      if (s?.success) setStats(s.data);
      if (o?.success) setNewOrders(o.data?.orders || []);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.green500} /></View>;

  const today = stats?.today || { revenue: 0, orders: 0 };
  const totals = stats?.totals || { revenue: 0, orders: 0, itemsSold: 0 };
  const newCount = stats?.newOrders || 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}>

        <View style={{ backgroundColor: C.green900, paddingBottom: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 20, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <Image source={require('../../assets/images/logo.png')} style={{ width: '100%', height: '100%', transform: [{ scale: 1.3 }] }} resizeMode="contain" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>Welcome back</Text>
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{shopName}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="notifications-outline" size={22} color="#fff" />
                {newCount > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.green900 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>{newCount > 9 ? '9+' : newCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: '600' }}>TODAY'S SALES</Text>
              <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{inr(today.revenue)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>📦 {today.orders} order{today.orders !== 1 ? 's' : ''} today</Text>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: -34 }}>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <Tile icon="cash-multiple" lib={MaterialCommunityIcons} label="Total sales" value={inr(totals.revenue)} tint={C.green500} />
            <Tile icon="receipt-outline" label="Total orders" value={totals.orders} tint={C.blue} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Tile icon="cube-outline" label="Items sold" value={totals.itemsSold} tint={C.amber} />
            <Tile icon="alert-circle-outline" label="New to accept" value={newCount} tint={C.red} />
          </View>
        </View>

        <View style={{ marginTop: 22, marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, flexDirection: 'row', justifyContent: 'space-between' }}>
          <QuickAction icon="add-circle-outline" label="Add Item" onPress={() => router.push('/add-product')} />
          <QuickAction icon="receipt-outline" label="Orders" onPress={() => router.push('/(tabs)/orders')} />
          <QuickAction icon="bar-chart-outline" label="Analytics" onPress={() => router.push('/(tabs)/analytics')} />
          <QuickAction icon="storefront-outline" label="My Shop" onPress={() => router.push('/manage-shop')} />
        </View>

        <View style={{ marginTop: 24, marginHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: C.text }}>New orders</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}><Text style={{ fontSize: 13, fontWeight: '700', color: C.green500 }}>See all</Text></TouchableOpacity>
          </View>

          {newOrders.length === 0 ? (
            <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
              <MaterialCommunityIcons name="bell-check-outline" size={36} color={C.green200} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.textMid, marginTop: 8 }}>You're all caught up 🎉</Text>
              <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>New orders will appear here instantly</Text>
            </View>
          ) : newOrders.map((o) => (
            <TouchableOpacity key={o._id} activeOpacity={0.85} onPress={() => router.push({ pathname: '/order-detail', params: { id: o._id } })}
              style={{ backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="receipt" size={20} color="#92400E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{o.orderId}</Text>
                <Text style={{ fontSize: 12, color: C.textSoft }} numberOfLines={1}>{o.totalItems} item{o.totalItems > 1 ? 's' : ''} · {o.items?.[0]?.name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: C.green500 }}>{inr(o.totalAmount)}</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: C.amber }}>Tap to accept →</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
