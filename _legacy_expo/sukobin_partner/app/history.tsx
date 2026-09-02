import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '@/lib/data';
import { api } from '@/lib/api';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

type HistoryItem = {
  kind: 'order' | 'parcel';
  refId: string;
  type: string;
  fee: number;
  dropLabel: string;
  deliveredAt: string;
};

const TYPE_ICON: Record<string, string> = {
  Order: 'storefront', Documents: 'file-document-outline', Electronics: 'chip', Food: 'food',
  Clothes: 'tshirt-crew', Medicines: 'medical-bag', Other: 'cube-outline', Parcel: 'cube-outline',
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(async (p: number, replace: boolean) => {
    try {
      const res = await api.get(`/api/partner/history?page=${p}&limit=20`);
      if (res?.success && res.data) {
        setItems((prev) => (replace ? res.data.items : [...prev, ...res.data.items]));
        setHasMore(!!res.data.hasMore);
        setPage(p);
      }
    } catch {
      // keep current list on failure
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchPage(1, true); }, [fetchPage]);

  const onRefresh = () => { setRefreshing(true); fetchPage(1, true); };
  const onEnd = () => {
    if (hasMore && !loadingMore && !loading) { setLoadingMore(true); fetchPage(page + 1, false); }
  };

  const totalEarned = items.reduce((s, i) => s + i.fee, 0);

  // group rows under day headers
  const rows: ({ header: string } | HistoryItem)[] = [];
  let lastDay = '';
  items.forEach((it) => {
    const d = dayLabel(it.deliveredAt);
    if (d !== lastDay) { rows.push({ header: d }); lastDay = d; }
    rows.push(it);
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
      {/* Header */}
      <View style={{ backgroundColor: C.bg2, paddingBottom: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 18, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.green200 }}>
              <Ionicons name="arrow-back" size={20} color={C.green900} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.green900, fontSize: 19, fontWeight: '900' }}>Delivery history</Text>
              <Text style={{ color: C.textMid, fontSize: 12.5, fontWeight: '600' }}>{items.length} delivered · {inr(totalEarned)} earned</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MaterialCommunityIcons name="history" size={42} color={C.green500} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '900', color: C.green900 }}>No deliveries yet</Text>
          <Text style={{ fontSize: 13, color: C.textMid, marginTop: 6, textAlign: 'center' }}>Completed orders & parcels will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => ('header' in item ? `h-${item.header}` : `${item.kind}-${item.refId}`) + i}
          contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          onEndReached={onEnd}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            if ('header' in item) {
              return <Text style={{ fontSize: 12, fontWeight: '800', color: C.textSoft, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 }}>{item.header}</Text>;
            }
            const isOrder = item.kind === 'order';
            return (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: C.border }}>
                <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialCommunityIcons name={(TYPE_ICON[item.type] || 'cube-outline') as any} size={21} color={C.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: isOrder ? '#EAF3FF' : C.green100, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: isOrder ? '#2563EB' : C.primaryDark }}>{isOrder ? 'ORDER' : 'PARCEL'}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{item.refId}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMid, marginTop: 3 }} numberOfLines={1}>📍 {item.dropLabel}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: C.primary }}>+{inr(item.fee)}</Text>
                  <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>{timeLabel(item.deliveredAt)}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </View>
  );
}
