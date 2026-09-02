import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StatusBar, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';

const C = {
  green900: '#1A3D2B', green700: '#2D6A4F', green500: '#40916C', green400: '#52B788', green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', amber: '#F4A261', red: '#E63946', border: '#EFEDE6', blue: '#3B82F6',
};
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const dayName = (iso: string) => { try { return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(iso).getDay()]; } catch { return ''; } };

const Bar = ({ value, max, day, delay }: any) => {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(h, { toValue: max ? value / max : 0, duration: 650, delay, useNativeDriver: false }).start(); }, [value, max]);
  const top = value === max && value > 0;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ height: 110, justifyContent: 'flex-end', width: 20 }}>
        <Animated.View style={{ width: 20, borderRadius: 6, backgroundColor: top ? C.green500 : C.green200, height: h.interpolate({ inputRange: [0, 1], outputRange: [4, 110] }) }} />
      </View>
      <Text style={{ fontSize: 10.5, color: C.textSoft, fontWeight: '700' }}>{day}</Text>
    </View>
  );
};

const StatusPill = ({ label, count, c, bg }: any) => (
  <View style={{ backgroundColor: bg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, minWidth: 100, flex: 1 }}>
    <Text style={{ fontSize: 22, fontWeight: '900', color: c }}>{count || 0}</Text>
    <Text style={{ fontSize: 11.5, color: c, fontWeight: '700', marginTop: 1 }}>{label}</Text>
  </View>
);

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await api.get('/api/merchant/stats'); if (res?.success) setStats(res.data); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.green500} /></View>;

  const totals = stats?.totals || { revenue: 0, orders: 0, itemsSold: 0 };
  const week = stats?.weekTrend || [];
  const maxW = Math.max(...week.map((w: any) => w.revenue), 1);
  const sc = stats?.statusCounts || {};
  const top = stats?.topProducts || [];
  const maxTop = Math.max(...top.map((p: any) => p.qty), 1);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#fff" />}>

        <View style={{ backgroundColor: C.green900, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Analytics</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>Your store performance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 16 }}>
                <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{inr(totals.revenue)}</Text>
                <Text style={{ color: C.amber, fontSize: 14, fontWeight: '800', marginBottom: 7 }}>total sales</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>🧾 {totals.orders} orders</Text>
                <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>📦 {totals.itemsSold} items sold</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Week chart */}
        <View style={{ marginHorizontal: 16, marginTop: -14, backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 14 }}>Sales · last 7 days</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {week.map((w: any, i: number) => <Bar key={i} value={w.revenue} max={maxW} day={dayName(w.date)} delay={i * 70} />)}
          </View>
        </View>

        {/* Status breakdown */}
        <Text style={lbl}>Orders by status</Text>
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatusPill label="New" count={sc.PLACED} c="#92400E" bg="#FEF3C7" />
            <StatusPill label="Preparing" count={(sc.ACCEPTED || 0) + (sc.PREPARING || 0)} c="#1E40AF" bg="#DBEAFE" />
            <StatusPill label="Ready" count={sc.READY_FOR_PICKUP} c="#6D28D9" bg="#EDE9FE" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatusPill label="Delivered" count={sc.DELIVERED} c="#166534" bg="#D8F3DC" />
            <StatusPill label="Cancelled" count={sc.CANCELLED} c="#991B1B" bg="#FEE2E2" />
          </View>
        </View>

        {/* Top products */}
        <Text style={lbl}>Top products</Text>
        <View style={{ marginHorizontal: 16, backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border }}>
          {top.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <MaterialCommunityIcons name="trophy-outline" size={34} color={C.green200} />
              <Text style={{ fontSize: 13, color: C.textMid, marginTop: 8, fontWeight: '600' }}>No sales yet</Text>
            </View>
          ) : top.map((p: any, i: number) => (
            <View key={i} style={{ marginBottom: i === top.length - 1 ? 0 : 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.text, flex: 1 }} numberOfLines={1}>
                  <Text style={{ color: C.green500, fontWeight: '900' }}>#{i + 1}  </Text>{p.name}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{inr(p.revenue)}</Text>
              </View>
              <View style={{ height: 7, backgroundColor: C.green50, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: `${(p.qty / maxTop) * 100}%`, height: 7, backgroundColor: C.green500, borderRadius: 4 }} />
              </View>
              <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 3 }}>{p.qty} sold</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const lbl: any = { fontSize: 12, fontWeight: '800', color: '#9AA8A0', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 12, marginLeft: 22 };
