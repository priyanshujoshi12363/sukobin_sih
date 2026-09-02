import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/utils/api';
import { takePendingLocation } from '@/utils/pendingLocation';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', red: '#E63946',
};

// react-native-maps with OSM tiles
let MapView: any = null, Marker: any = null, UrlTile: any = null;
if (Platform.OS !== 'web') {
  try {
    const m = require('react-native-maps');
    MapView = m.default;
    Marker = m.Marker;
    UrlTile = m.UrlTile;
  } catch {}
}

const Field = ({ label, value, onChangeText, placeholder, keyboardType, icon, half }: any) => (
  <View style={{ width: half ? '48%' : '100%', marginBottom: 14 }}>
    <Text style={{ fontSize: 12, fontWeight: '700', color: C.textMid, marginBottom: 6 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.green100, paddingHorizontal: 12 }}>
      {icon && <Ionicons name={icon} size={16} color={C.green400} style={{ marginRight: 8 }} />}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9CA3AF" keyboardType={keyboardType || 'default'} style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: C.text }} />
    </View>
  </View>
);

export default function DeliveryAddressScreen() {
  const params = useLocalSearchParams();
  const next = String(params.next || '');
  const toCheckout = next === 'checkout';

  const [form, setForm] = useState({
    name: '', houseNumber: '', landmark: '', village: '', town: '',
    district: '', state: '', pincode: '', fullAddress: '',
  });
  const [coordinates, setCoordinates] = useState<number[] | null>(null); // [lng, lat]
  const [locationLabel, setLocationLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Prefill from saved user data (and optional params.data override)
  useEffect(() => {
    (async () => {
      try {
        let base: any = {};
        const raw = await AsyncStorage.getItem('userData');
        if (raw) base = JSON.parse(raw);
        if (params.data) { try { base = { ...base, ...JSON.parse(String(params.data)) }; } catch {} }

        const a = base.address || base;
        setForm({
          name: base.name || '',
          houseNumber: a.houseNumber || '',
          landmark: a.landmark || '',
          village: a.village || '',
          town: a.town || '',
          district: a.district || '',
          state: a.state || '',
          pincode: a.pincode || '',
          fullAddress: a.fullAddress || '',
        });
        const coords = base.location?.coordinates || base.coordinates;
        if (Array.isArray(coords) && coords.length === 2) {
          setCoordinates(coords);
          setLocationLabel(a.fullAddress || '');
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  // Pick up the map-selected location on return
  useFocusEffect(useCallback(() => {
    const picked = takePendingLocation();
    if (picked && picked.target === 'delivery') {
      setCoordinates(picked.coordinates);
      setLocationLabel(picked.address);
      // help the user: prefill full address from the pin if empty
      setForm((f) => (f.fullAddress ? f : { ...f, fullAddress: picked.address }));
    }
  }, []));

  const openPicker = () => {
    router.push({ pathname: '/pick-location', params: { target: 'delivery', lat: coordinates?.[1] ?? '', lng: coordinates?.[0] ?? '' } });
  };

  const handleSave = async () => {
    if (!coordinates) { Alert.alert('Pin your location', 'Please set your delivery location on the map.'); return; }
    if (!form.name.trim() || !form.fullAddress.trim() || !form.district.trim() || !form.state.trim() || !form.pincode.trim()) {
      Alert.alert('Missing details', 'Name, full address, district, state and pincode are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/api/order/edit-address', { ...form, coordinates });
      if (res?.success) {
        // keep local copy fresh for next time
        try {
          const raw = await AsyncStorage.getItem('userData');
          const u = raw ? JSON.parse(raw) : {};
          u.name = form.name;
          u.address = { ...form };
          u.location = { type: 'Point', coordinates };
          await AsyncStorage.setItem('userData', JSON.stringify(u));
        } catch {}

        if (toCheckout) router.replace('/checkout');
        else router.back();
      } else {
        Alert.alert('Error', res?.message || 'Could not save address');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.green400} /></View>;
  }

  const lat = coordinates?.[1], lng = coordinates?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={C.green900} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>Delivery Address</Text>
            {toCheckout && <Text style={{ fontSize: 12, color: C.textSoft }}>Confirm where to deliver, then pay</Text>}
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 320 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

            {/* ── Map pin with OSM tiles ── */}
            <Text style={sectionLabel}>Pin location *</Text>
            {coordinates && MapView ? (
              <TouchableOpacity activeOpacity={0.9} onPress={openPicker} style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.green100 }}>
                <View pointerEvents="none">
                  <MapView
                    style={{ height: 170, width: '100%' }}
                    initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
                    region={{ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
                    scrollEnabled={false} 
                    zoomEnabled={false} 
                    rotateEnabled={false} 
                    pitchEnabled={false}
                    mapType="none" // Important: use 'none' for custom tiles
                  >
                    {/* OpenStreetMap Tile Layer */}
                    {UrlTile && (
                      <UrlTile
                        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maximumZ={19}
                        flipY={false}
                      />
                    )}
                    {Marker && <Marker coordinate={{ latitude: lat, longitude: lng }} />}
                  </MapView>
                </View>
                <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 4, elevation: 3 }}>
                  <Ionicons name="map-outline" size={13} color={C.green500} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.green500 }}>Change</Text>
                </View>
                <View style={{ backgroundColor: C.white, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Ionicons name="location" size={16} color={C.red} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: C.text }} numberOfLines={2}>{locationLabel || 'Pinned location'}</Text>
                    <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 2 }}>📍 {lat?.toFixed(5)}, {lng?.toFixed(5)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openPicker} activeOpacity={0.9} style={{ backgroundColor: C.white, borderRadius: 18, borderWidth: 1.5, borderColor: C.green400, borderStyle: 'dashed', paddingVertical: 22, alignItems: 'center', gap: 8 }}>
                <Ionicons name="map" size={28} color={C.green500} />
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.green700 }}>Set delivery location on map</Text>
                <Text style={{ fontSize: 12, color: C.textSoft }}>Required to continue</Text>
              </TouchableOpacity>
            )}

            {/* ── Address fields ── */}
            <Text style={sectionLabel}>Address details</Text>
            <Field label="Full Name *" value={form.name} onChangeText={set('name')} placeholder="Your name" icon="person-outline" />
            <Field label="Full Address *" value={form.fullAddress} onChangeText={set('fullAddress')} placeholder="House, street, area" icon="home-outline" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Field label="House No." value={form.houseNumber} onChangeText={set('houseNumber')} placeholder="e.g. 12B" half />
              <Field label="Landmark" value={form.landmark} onChangeText={set('landmark')} placeholder="Near…" half />
              <Field label="Village" value={form.village} onChangeText={set('village')} placeholder="Village" half />
              <Field label="Town" value={form.town} onChangeText={set('town')} placeholder="Town" half />
              <Field label="District *" value={form.district} onChangeText={set('district')} placeholder="District" half />
              <Field label="State *" value={form.state} onChangeText={set('state')} placeholder="State" half />
            </View>
            <Field label="Pincode *" value={form.pincode} onChangeText={set('pincode')} placeholder="6-digit pincode" keyboardType="number-pad" icon="map-outline" />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Save bar */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.green100, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 }}>
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.9}
            style={{ backgroundColor: coordinates ? C.green400 : C.green200, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving
              ? <ActivityIndicator size="small" color={C.white} />
              : <><Ionicons name={toCheckout ? 'arrow-forward-circle' : 'checkmark-circle'} size={18} color={C.white} /><Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>{toCheckout ? 'Save & Continue to Checkout' : 'Save Address'}</Text></>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const sectionLabel: any = { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginTop: 18, marginBottom: 10 };