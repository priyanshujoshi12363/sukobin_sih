import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StatusBar, ActivityIndicator, Animated, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/utils/api";
import { takePendingLocation } from "@/utils/pendingLocation";

const C = {
  green900: "#1A3D2B", green700: "#15661A", green500: "#0C831F", green400: "#0C831F",
  green200: "#B7E4C7", green100: "#D8F3DC", green50: "#F0FAF3",
  white: "#FFFFFF", bg: "#F9F8F4", text: "#1A3D2B", textMid: "#4A7560", textSoft: "#7DAA90", red: "#E63946",
};

const TYPES = [
  { key: "Documents", icon: "document-text-outline" },
  { key: "Electronics", icon: "hardware-chip-outline" },
  { key: "Food", icon: "fast-food-outline" },
  { key: "Clothes", icon: "shirt-outline" },
  { key: "Medicines", icon: "medkit-outline" },
  { key: "Other", icon: "cube-outline" },
];

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

type Loc = { coordinates?: number[]; address: string }; // [lng, lat]

export default function ParcelScreen() {
  const [pickup, setPickup] = useState<Loc>({ address: "" });
  const [drop, setDrop] = useState<Loc>({ address: "" });
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [type, setType] = useState("Other");
  const [weightValue, setWeightValue] = useState("1");
  const [weightUnit, setWeightUnit] = useState<"kg" | "g">("kg");
  const [description, setDescription] = useState("");

  // Weight in kilograms for the backend (grams → kg). Anything from a few grams up.
  const weightKg = weightUnit === "g" ? (Number(weightValue) || 0) / 1000 : (Number(weightValue) || 0);

  const [quote, setQuote] = useState<any>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);

  const estAnim = useRef(new Animated.Value(0)).current;

  // the floating tab bar's top edge — so the CTA sits ABOVE it (not hidden under it)
  const insets = useSafeAreaInsets();
  const tabBarTop = Math.max(insets.bottom + 12, 16) + 62;

  // Default pickup = user's saved pinned home location
  useEffect(() => {
    AsyncStorage.getItem("userData").then((raw) => {
      if (!raw) return;
      const u = JSON.parse(raw);
      const coords = u?.location?.coordinates;
      const addr = u?.address?.fullAddress
        || [u?.address?.village, u?.address?.town, u?.address?.district].filter(Boolean).join(", ");
      setPickup({ coordinates: Array.isArray(coords) && coords.length === 2 ? coords : undefined, address: addr || "" });
    });
  }, []);

  // Pick up the exact coordinate chosen on the map screen when we return
  useFocusEffect(useCallback(() => {
    const picked = takePendingLocation();
    if (!picked) return;
    if (picked.target === "pickup") setPickup({ coordinates: picked.coordinates, address: picked.address });
    else if (picked.target === "drop") setDrop({ coordinates: picked.coordinates, address: picked.address });
    setQuote(null);
  }, []));

  // Auto-price whenever both points are pinned (coordinates → accurate, no geocoding)
  useEffect(() => {
    if (!pickup.coordinates || !drop.coordinates) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.post("/api/parcel/quote", {
          pickup: { coordinates: pickup.coordinates },
          drop: { coordinates: drop.coordinates },
          weightKg,
          type,
        });
        if (!cancelled) setQuote(res?.success ? res.quote : null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickup.coordinates, drop.coordinates, weightValue, weightUnit, type]);

  useEffect(() => {
    Animated.timing(estAnim, { toValue: quote ? 1 : 0, duration: 350, useNativeDriver: true }).start();
  }, [quote, estAnim]);

  const openPicker = (target: "pickup" | "drop") => {
    const c = target === "pickup" ? pickup.coordinates : drop.coordinates;
    router.push({ pathname: "/pick-location", params: { target, lat: c?.[1] ?? "", lng: c?.[0] ?? "" } });
  };

  const requestPickup = async () => {
    if (!pickup.coordinates) { Alert.alert("Pickup needed", "Set the pickup location on the map."); return; }
    if (!drop.coordinates) { Alert.alert("Drop needed", "Set the drop location on the map."); return; }
    if (!receiverName.trim() || !receiverPhone.trim()) { Alert.alert("Receiver details", "Add the receiver’s name and phone."); return; }

    setBooking(true);
    try {
      const res = await api.post("/api/parcel/create", {
        pickup: { coordinates: pickup.coordinates, address: { fullAddress: pickup.address } },
        drop: {
          coordinates: drop.coordinates,
          address: { fullAddress: drop.address },
          contactName: receiverName.trim(),
          contactPhone: receiverPhone.trim(),
        },
        weightKg,
        type,
        description: description.trim(),
      });
      if (res?.success) {
        const p = res.data?.parcel;
        Alert.alert("Parcel requested 📦", `${p?.parcelId}\nTotal ${inr(p?.totalAmount)} · pay on pickup.\n\nWe’ll match a partner travelling your route.`, [{ text: "Done", onPress: resetForm }]);
      } else {
        Alert.alert("Couldn’t create", res?.message || "Try again.");
      }
    } catch {
      Alert.alert("Error", "Something went wrong while requesting.");
    } finally {
      setBooking(false);
    }
  };

  const resetForm = () => {
    setDrop({ address: "" }); setReceiverName(""); setReceiverPhone("");
    setDescription(""); setType("Other"); setWeightValue("1"); setWeightUnit("kg"); setQuote(null);
  };

  const LocRow = ({ label, loc, onPress, drop: isDrop }: { label: string; loc: Loc; onPress: () => void; drop?: boolean }) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      {isDrop
        ? <Ionicons name="location" size={15} color={C.red} style={{ marginTop: 15 }} />
        : <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.green400, marginTop: 17 }} />}
      <View style={{ flex: 1 }}>
        <Text style={labelMini}>{label}</Text>
        {loc.coordinates
          ? <Text style={{ fontSize: 14, fontWeight: "600", color: C.text, lineHeight: 19 }} numberOfLines={2}>{loc.address || "Pinned location"}</Text>
          : <Text style={{ fontSize: 14, fontWeight: "700", color: C.green500 }}>Set on map</Text>}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginTop: 13 }}>
        <Ionicons name="map-outline" size={14} color={C.green500} />
        <Text style={{ fontSize: 12.5, fontWeight: "700", color: C.green500 }}>{loc.coordinates ? "Change" : "Set"}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.green900} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarTop + 96 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <LinearGradient colors={[C.green700, C.green900]} style={{ paddingTop: 60, paddingBottom: 26, paddingHorizontal: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name="package-variant-closed" size={26} color={C.white} />
              <Text style={{ fontSize: 24, fontWeight: "900", color: C.white }}>Send a Parcel</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4, fontSize: 13 }}>
              Riders already on your route carry it — cheaper & faster across the hills.
            </Text>
          </LinearGradient>

          <View style={{ paddingHorizontal: 18, marginTop: 16 }}>

            {/* Route — pin exact pickup & drop on the map */}
            <View style={card}>
              <LocRow label="INITIAL · PICKUP" loc={pickup} onPress={() => openPicker("pickup")} />
              <View style={{ height: 1, backgroundColor: C.green50, marginVertical: 12, marginLeft: 22 }} />
              <LocRow label="FINAL · DROP" loc={drop} onPress={() => openPicker("drop")} drop />

              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12, marginLeft: 22 }}>
                <Ionicons name="map-outline" size={13} color={C.textSoft} />
                <Text style={{ fontSize: 11.5, color: C.textSoft, flex: 1 }}>Tap to open the map and drop the pin on the exact spot.</Text>
              </View>
            </View>

            {/* Receiver */}
            <Text style={sectionLabel}>Receiver</Text>
            <View style={card}>
              <Input icon="person-outline" value={receiverName} onChangeText={setReceiverName} placeholder="Receiver name" />
              <View style={{ height: 10 }} />
              <Input icon="call-outline" value={receiverPhone} onChangeText={setReceiverPhone} placeholder="Receiver phone" keyboardType="phone-pad" />
            </View>

            {/* Type */}
            <Text style={sectionLabel}>Parcel Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
              {TYPES.map((t) => {
                const active = type === t.key;
                return (
                  <TouchableOpacity key={t.key} onPress={() => setType(t.key)} activeOpacity={0.85}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: active ? C.green400 : C.white, borderWidth: 1, borderColor: active ? C.green400 : "#EFEDE6" }}>
                    <Ionicons name={t.icon as any} size={15} color={active ? C.white : C.green500} />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: active ? C.white : C.text }}>{t.key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Weight + notes */}
            <Text style={sectionLabel}>Weight & Notes</Text>
            <View style={card}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: C.text }}>Weight</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ backgroundColor: C.green50, borderRadius: 12, borderWidth: 1, borderColor: C.green100, width: 84 }}>
                    <TextInput
                      value={weightValue}
                      onChangeText={(t) => setWeightValue(t.replace(/[^0-9.]/g, ""))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      style={{ paddingVertical: 10, fontSize: 15, fontWeight: "800", color: C.green900, textAlign: "center" }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", backgroundColor: C.green50, borderRadius: 12, borderWidth: 1, borderColor: C.green100, overflow: "hidden" }}>
                    {(["g", "kg"] as const).map((u) => (
                      <TouchableOpacity key={u} onPress={() => setWeightUnit(u)} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: weightUnit === u ? C.green400 : "transparent" }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: weightUnit === u ? C.white : C.textMid }}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 8 }}>Enter any weight — e.g. 250 g, 1.5 kg.</Text>
              <View style={{ height: 12 }} />
              <Input icon="create-outline" value={description} onChangeText={setDescription} placeholder="What's inside? (optional)" />
            </View>

            {/* Estimate */}
            {(quote || quoting) && (
              <Animated.View style={{ opacity: estAnim, transform: [{ translateY: estAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], marginTop: 18, backgroundColor: C.green50, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.green200 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: C.green700 }}>Fare Estimate</Text>
                  {quoting
                    ? <ActivityIndicator size="small" color={C.green400} />
                    : <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.white, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Ionicons name="navigate" size={12} color={C.green500} />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: C.green700 }}>{quote?.distanceKm} km</Text>
                      </View>}
                </View>
                {quote && (
                  <>
                    <Line label="Delivery charge" value={inr(quote.deliveryCharge)} />
                    <Line label="Platform fee" value={inr(quote.platformFee)} />
                    <View style={{ height: 1, backgroundColor: C.green200, marginVertical: 10 }} />
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: C.text }}>Total</Text>
                      <Text style={{ fontSize: 22, fontWeight: "900", color: C.green500 }}>{inr(quote.totalAmount)}</Text>
                    </View>
                    <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 6 }}>Pay cash on pickup. Fare updates with weight & type.</Text>
                  </>
                )}
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* Floating request CTA — sits just above the floating tab bar */}
        <View style={{ position: "absolute", left: 16, right: 16, bottom: tabBarTop + 12 }}>
          <TouchableOpacity onPress={requestPickup} disabled={booking} activeOpacity={0.9}
            style={{ backgroundColor: quote ? C.green400 : C.green500, borderRadius: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: C.green900, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 9 }}>
            {booking
              ? <ActivityIndicator size="small" color={C.white} />
              : (
                <>
                  <MaterialCommunityIcons name="package-variant-closed-check" size={19} color={C.white} />
                  <Text style={{ color: C.white, fontWeight: "900", fontSize: 16 }}>
                    {quote ? `Request Pickup · ${inr(quote.totalAmount)}` : "Request Pickup"}
                  </Text>
                </>
              )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const Input = ({ icon, ...props }: any) => (
  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.green50, borderRadius: 12, borderWidth: 1, borderColor: C.green100, paddingHorizontal: 12 }}>
    <Ionicons name={icon} size={16} color={C.green400} style={{ marginRight: 8 }} />
    <TextInput placeholderTextColor="#9CA3AF" style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: C.text }} {...props} />
  </View>
);

const Line = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }}>
    <Text style={{ fontSize: 13.5, color: C.textMid }}>{label}</Text>
    <Text style={{ fontSize: 13.5, fontWeight: "700", color: C.text }}>{value}</Text>
  </View>
);

const card: any = { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#EFEDE6" };
const sectionLabel: any = { fontSize: 12, fontWeight: "800", color: "#9CA3AF", letterSpacing: 1, textTransform: "uppercase", marginTop: 20, marginBottom: 10 };
const labelMini: any = { fontSize: 10.5, fontWeight: "800", color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 };
