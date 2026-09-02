import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', red: '#E63946',
};

interface UserData {
  name: string; phone: string; _id: string;
  address?: any; location?: any;
}

const QuickTile = ({ icon, label, onPress }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1, backgroundColor: C.white, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#EFEDE6' }}>
    <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={20} color={C.green500} />
    </View>
    <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.text }}>{label}</Text>
  </TouchableOpacity>
);

const MenuRow = ({ icon, label, sub, onPress, danger, last }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#F1EFE8' }}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: danger ? '#FFF0F0' : C.green50, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={19} color={danger ? C.red : C.green500} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ fontSize: 14.5, fontWeight: '700', color: danger ? C.red : C.text }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 11.5, color: C.textSoft, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
    </View>
    {!danger && <Ionicons name="chevron-forward" size={18} color="#C9D6CE" />}
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('userData');
      if (stored) setUserData(JSON.parse(stored));
    } catch (e) {
      console.error('Error loading user data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadUserData(); }, [loadUserData]));

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.multiRemove(['userToken', 'userData', 'loginResponse', 'sukobin_cart']);
            router.replace('/(auth)/welcome');
          } catch (e) { console.error('Logout error:', e); }
        },
      },
    ]);
  };

  const openAddress = () => {
    const a = userData?.address || {};
    router.push({ pathname: '/edit-address', params: { data: JSON.stringify({ name: userData?.name, ...a }) } });
  };

  const soon = () => Alert.alert('Coming soon', 'This feature is on the way. ');

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.green400} />
      </View>
    );
  }

  const addr = userData?.address;
  const addrLine = addr?.fullAddress || [addr?.houseNumber, addr?.village, addr?.town].filter(Boolean).join(', ');
  const initial = userData?.name ? userData.name.charAt(0).toUpperCase() : 'U';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.green900} translucent={false} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Gradient header with avatar */}
        <LinearGradient colors={[C.green700, C.green900]} style={{ paddingTop: 64, paddingBottom: 30, paddingHorizontal: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' }}>My Profile</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 24, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }}>
              <Text style={{ fontSize: 30, fontWeight: '900', color: C.green700 }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 21, fontWeight: '900', color: C.white }} numberOfLines={1}>{userData?.name || 'User'}</Text>
              <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {userData?.phone ? `+91 ${userData.phone}` : 'No phone number'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 }}>
                <Ionicons name="checkmark-circle" size={12} color={C.green200} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: C.white }}>Verified</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: -16 }}>
          <QuickTile icon="receipt-outline" label="Orders" onPress={() => router.push('/(tabs)/orders')} />
          <QuickTile icon="cart-outline" label="Cart" onPress={() => router.push('/cart')} />
          <QuickTile icon="cube-outline" label="Parcel" onPress={() => router.push('/(tabs)/parcel')} />
        </View>

        {/* Account */}
        <Text style={sectionLabel}>Account</Text>
        <View style={cardStyle}>
          <MenuRow icon="location-outline" label="Saved Address" sub={addrLine || 'Add a delivery address'} onPress={openAddress} />
          <MenuRow icon="card-outline" label="Payment Methods" sub="UPI · Cards via Razorpay" onPress={soon} />
          <MenuRow icon="notifications-outline" label="Notifications" onPress={soon} last />
        </View>

        {/* More */}
        <Text style={sectionLabel}>More</Text>
        <View style={cardStyle}>
          <MenuRow icon="help-circle-outline" label="Help & Support" onPress={soon} />
          <MenuRow icon="shield-checkmark-outline" label="Privacy & Security" onPress={soon} />
          <MenuRow icon="information-circle-outline" label="About Sukobin" sub="v1.0.0" onPress={soon} last />
        </View>

        {/* Logout */}
        <View style={[cardStyle, { marginTop: 18 }]}>
          <MenuRow icon="log-out-outline" label="Log out" danger onPress={handleLogout} last />
        </View>

        <Text style={{ textAlign: 'center', color: C.textSoft, fontSize: 11.5, marginTop: 22, fontWeight: '500' }}>
          Sukobin · Made for the hills 🏔️
        </Text>
      </ScrollView>
    </View>
  );
}

const sectionLabel: any = { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 10, marginLeft: 22 };
const cardStyle: any = { backgroundColor: '#FFFFFF', marginHorizontal: 18, borderRadius: 18, borderWidth: 1, borderColor: '#EFEDE6', overflow: 'hidden' };
