import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, getVehicle } from '@/lib/data';
import { LocationTracker } from '@/lib/location';

const Row = ({ icon, lib: Lib = Ionicons, label, value, onPress, danger, last }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1F4F1' }}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? '#FFF0F0' : C.green50, alignItems: 'center', justifyContent: 'center' }}>
      <Lib name={icon} size={18} color={danger ? C.red : C.primary} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ fontSize: 14.5, fontWeight: '700', color: danger ? C.red : C.text }}>{label}</Text>
      {value ? <Text style={{ fontSize: 12, color: C.textSoft, marginTop: 1 }}>{value}</Text> : null}
    </View>
    {!danger && <Ionicons name="chevron-forward" size={18} color="#CDD8D1" />}
  </TouchableOpacity>
);

const card: any = { backgroundColor: '#fff', marginHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden' };
const label: any = { fontSize: 12, fontWeight: '800', color: '#9AA8A0', letterSpacing: 1, textTransform: 'uppercase', marginTop: 20, marginBottom: 10, marginLeft: 22 };

export default function Profile() {
  const [d, setD] = useState<any>(null);
  useFocusEffect(useCallback(() => { AsyncStorage.getItem('partnerData').then((r) => r && setD(JSON.parse(r))); }, []));

  const vehicle = getVehicle(d?.vehicleType);
  const initial = d?.name ? d.name.charAt(0).toUpperCase() : 'D';

  const logout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { LocationTracker.stop(); await AsyncStorage.multiRemove(['partnerToken', 'partnerData', 'partnerExpoToken']); router.replace('/(auth)/welcome'); } },
    ]);
  };
  const soon = () => Alert.alert('Coming soon', 'This feature is on the way.');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ backgroundColor: C.bg2, paddingBottom: 30, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 22, paddingTop: 6 }}>
              <Text style={{ color: C.textSoft, fontSize: 13, fontWeight: '700' }}>Partner profile</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 }}>
                <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.white, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 }}>
                  <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff' }}>{initial}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.green900, fontSize: 21, fontWeight: '900' }} numberOfLines={1}>{d?.name || 'Partner'}</Text>
                  <Text style={{ color: C.textMid, fontSize: 13.5, marginTop: 2, fontWeight: '600' }}>+91 {d?.phone || '—'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', backgroundColor: C.white, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, borderWidth: 1, borderColor: C.green200 }}>
                    <Ionicons name="star" size={12} color={C.amber} />
                    <Text style={{ color: C.green900, fontSize: 11.5, fontWeight: '800' }}>{(d?.rating ?? 4.8)} · {d?.totalTrips ?? 0} trips</Text>
                  </View>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Vehicle card */}
        <View style={[card, { marginTop: -16, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }]}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={vehicle.icon as any} size={26} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>{d?.vehicleNumber || 'UK 04 AB 1234'}</Text>
            <Text style={{ fontSize: 12.5, color: C.textMid, marginTop: 1 }}>{vehicle.label} · carries up to {vehicle.capacity}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.green100, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 }}>
            <Ionicons name="shield-checkmark" size={13} color={C.primary} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.primaryDark }}>Verified</Text>
          </View>
        </View>

        <Text style={label}>Account</Text>
        <View style={card}>
          <Row icon="time-outline" label="Delivery history" value="Your past deliveries" onPress={() => router.push('/history' as any)} />
          <Row icon="cash-outline" label="Earnings & payouts" onPress={() => router.push('/(tabs)/stats')} />
          <Row icon="car-outline" label="Vehicle details" value={d?.vehicleNumber} onPress={soon} />
          <Row icon="document-text-outline" label="Documents" value="License · RC · Insurance" onPress={soon} last />
        </View>

        <Text style={label}>More</Text>
        <View style={card}>
          <Row icon="help-circle-outline" label="Help & support" onPress={soon} />
          <Row icon="shield-checkmark-outline" label="Safety" onPress={soon} />
          <Row icon="information-circle-outline" label="About Sukobin Partner" value="v1.0.0" onPress={soon} last />
        </View>

        <View style={[card, { marginTop: 18 }]}>
          <Row icon="log-out-outline" label="Log out" danger onPress={logout} last />
        </View>

        <Text style={{ textAlign: 'center', color: C.textSoft, fontSize: 11.5, marginTop: 22, fontWeight: '500' }}>Sukobin Partner · Drive the hills 🏔️</Text>
      </ScrollView>
    </View>
  );
}
