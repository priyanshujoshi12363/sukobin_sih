import { useCallback, useState } from "react";
import {
  View, Text, FlatList, StatusBar, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import api from "@/utils/api";

const C = {
  green900: "#1A3D2B", green700: "#15661A", green500: "#0C831F", green400: "#0C831F",
  green200: "#B7E4C7", green100: "#D8F3DC", green50: "#F0FAF3",
  white: "#FFFFFF", bg: "#F9F8F4", text: "#1A3D2B", textMid: "#4A7560", textSoft: "#7DAA90", red: "#E63946", amber: "#E8962F",
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type Item = {
  kind: "order" | "parcel";
  refId: string;
  status: string;
  title: string;
  subtitle: string;
  image: string | null;
  amount: number;
  date: string;
};

// status → colour + readable label
const STATUS: Record<string, { color: string; label: string }> = {
  DELIVERED: { color: C.green500, label: "Delivered" },
  CANCELLED: { color: C.red, label: "Cancelled" },
  EXPIRED: { color: C.red, label: "Expired" },
  FAILED: { color: C.red, label: "Failed" },
  REQUESTED: { color: C.amber, label: "Requested" },
  POOLED: { color: C.amber, label: "Finding partner" },
  ASSIGNED: { color: C.amber, label: "Partner assigned" },
  PICKED_UP: { color: C.amber, label: "Picked up" },
  IN_TRANSIT: { color: C.amber, label: "On the way" },
};
const statusOf = (s: string) => STATUS[s] || { color: C.textSoft, label: s };

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarPad = Math.max(insets.bottom + 12, 16) + 62 + 20;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/api/order/history");
      if (res?.success && res.data) setItems(res.data.items || []);
    } catch {
      // keep last list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  // group under day headers
  const rows: ({ header: string } | Item)[] = [];
  let lastDay = "";
  items.forEach((it) => {
    const d = dayLabel(it.date);
    if (d !== lastDay) { rows.push({ header: d }); lastDay = d; }
    rows.push(it);
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.bg }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 }}>
          <Text style={{ fontSize: 26, fontWeight: "900", color: C.green900 }}>History</Text>
          <Text style={{ fontSize: 13, color: C.textSoft, marginTop: 2, fontWeight: "600" }}>Your orders & parcels</Text>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={C.green500} />
        </View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }}>
          <View style={{ width: 92, height: 92, borderRadius: 28, backgroundColor: C.green100, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="time-outline" size={44} color={C.green500} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: "900", color: C.green900 }}>Nothing here yet</Text>
          <Text style={{ fontSize: 13, color: C.textMid, marginTop: 6, textAlign: "center" }}>Your delivered orders and parcels will show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => ("header" in item ? `h-${item.header}` : `${item.kind}-${item.refId}`) + i}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: tabBarPad }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green500} />}
          renderItem={({ item }) => {
            if ("header" in item) {
              return <Text style={{ fontSize: 12, fontWeight: "800", color: C.textSoft, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 16, marginBottom: 8, marginLeft: 4 }}>{item.header}</Text>;
            }
            const isOrder = item.kind === "order";
            const st = statusOf(item.status);
            return (
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.white, borderRadius: 16, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#EFEDE6" }}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: C.green50 }} />
                ) : (
                  <View style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: C.green50, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={isOrder ? "storefront-outline" : "package-variant-closed"} size={22} color={C.green500} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ backgroundColor: isOrder ? "#EAF3FF" : C.green100, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                      <Text style={{ fontSize: 9, fontWeight: "900", color: isOrder ? "#2563EB" : C.green700 }}>{isOrder ? "ORDER" : "PARCEL"}</Text>
                    </View>
                    <Text style={{ fontSize: 13.5, fontWeight: "800", color: C.text }} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: C.textMid, marginTop: 3 }} numberOfLines={1}>{item.subtitle}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: st.color }}>{st.label}</Text>
                    <Text style={{ fontSize: 11, color: C.textSoft }}> · {item.refId}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "900", color: C.green900 }}>{inr(item.amount)}</Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
