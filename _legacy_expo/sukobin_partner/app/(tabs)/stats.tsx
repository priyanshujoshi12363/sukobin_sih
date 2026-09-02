import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StatusBar, Animated, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/lib/data';
import { api } from '@/lib/api';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// weekTrend[0] = 6 days ago … weekTrend[6] = today → real weekday initial for each bar
const dayLabel = (i: number) => {
  const d = new Date();
  d.setDate(d.getDate() - (6 - i));
  return WD[d.getDay()];
};

type Stats = {
  today: { earnings: number; deliveries: number };
  lifetime: { earnings: number; deliveries: number; trips: number; rating: number; wallet: number };
  weekTrend: number[];
  active: number;
  isOnline: boolean;
};

const EMPTY: Stats = {
  today: { earnings: 0, deliveries: 0 },
  lifetime: { earnings: 0, deliveries: 0, trips: 0, rating: 5, wallet: 0 },
  weekTrend: [0, 0, 0, 0, 0, 0, 0],
  active: 0,
  isOnline: false,
};

const StatTile = ({ icon, lib: Lib, label, value, tint }: any) => (
  <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.border }}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: tint + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
      <Lib name={icon} size={19} color={tint} />
    </View>
    <Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>{value}</Text>
    <Text style={{ fontSize: 11.5, color: C.textSoft, fontWeight: '600', marginTop: 1 }}>{label}</Text>
  </View>
);

const Bar = ({ value, max, day }: any) => {
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(h, { toValue: max ? value / max : 0, duration: 600, useNativeDriver: false }).start(); }, [value, max]);
  const isTop = value === max && value > 0;
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={{ height: 120, justifyContent: 'flex-end', width: 22 }}>
        <Animated.View style={{ width: 22, borderRadius: 7, backgroundColor: isTop ? C.primary : C.green200, height: h.interpolate({ inputRange: [0, 1], outputRange: [4, 120] }) }} />
      </View>
      <Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '700' }}>{day}</Text>
    </View>
  );
};

export default function Stats() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/partner/stats');
      if (res?.success && res.data) setStats({ ...EMPTY, ...res.data });
    } catch {
      // keep last known stats on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const max = Math.max(...stats.weekTrend, 1);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
      <View style={{ backgroundColor: C.bg2, paddingBottom: 28, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.green900, fontSize: 22, fontWeight: '900' }}>Your earnings</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.white, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: C.green200 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stats.isOnline ? C.primary : C.textSoft }} />
                <Text style={{ color: stats.isOnline ? C.primary : C.textSoft, fontSize: 11.5, fontWeight: '800' }}>{stats.isOnline ? 'Online' : 'Offline'}</Text>
              </View>
            </View>
            <Text style={{ color: C.textSoft, fontSize: 13, marginTop: 2, fontWeight: '600' }}>Today, this week & lifetime</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 16 }}>
              <Text style={{ color: C.green900, fontSize: 38, fontWeight: '900', letterSpacing: -1 }}>{inr(stats.today.earnings)}</Text>
              <Text style={{ color: C.green500, fontSize: 14, fontWeight: '800', marginBottom: 8 }}>today</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <Text style={{ color: C.textMid, fontSize: 12.5, fontWeight: '600' }}>📦 {stats.today.deliveries} delivered today</Text>
              {stats.active > 0 ? (
                <TouchableOpacity onPress={() => router.push('/trip')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 }}>
                  <MaterialCommunityIcons name="truck-fast" size={13} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{stats.active} active · resume</Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: C.textMid, fontSize: 12.5, fontWeight: '600' }}>🚚 {stats.active} active</Text>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}>
          {/* Week chart */}
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, marginTop: -14 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: C.text, marginBottom: 14 }}>This week</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              {stats.weekTrend.map((v, i) => <Bar key={i} value={v} max={max} day={dayLabel(i)} />)}
            </View>
          </View>

          {/* Lifetime tiles */}
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#9AA8A0', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 }}>Lifetime</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <StatTile icon="cash-multiple" lib={MaterialCommunityIcons} label="Total earned" value={inr(stats.lifetime.earnings)} tint={C.primary} />
            <StatTile icon="steering" lib={MaterialCommunityIcons} label="Total trips" value={stats.lifetime.trips} tint={C.blue} />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile icon="package-variant-closed" lib={MaterialCommunityIcons} label="Deliveries" value={stats.lifetime.deliveries} tint={C.amber} />
            <StatTile icon="star" lib={Ionicons} label="Rating" value={Number(stats.lifetime.rating ?? 5).toFixed(1)} tint="#F4A261" />
          </View>

          {/* Wallet */}
          <View style={{ backgroundColor: C.green900, borderRadius: 18, padding: 18, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 12, color: C.green200, fontWeight: '700' }}>Wallet balance</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 3 }}>{inr(stats.lifetime.wallet)}</Text>
            </View>
            <MaterialCommunityIcons name="wallet" size={34} color={C.green400} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}
