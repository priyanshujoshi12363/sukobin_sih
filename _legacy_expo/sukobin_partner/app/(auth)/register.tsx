import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { getVehicle } from '@/lib/data';

const LC = {
  primary: '#2D6A4F', dark: '#1A3D2B', green50: '#F0FAF3', green100: '#D8F3DC', green200: '#B7E4C7',
  white: '#FFFFFF', text: '#1A3D2B', textMid: '#5B7A68', textSoft: '#7DAA90', border: '#DCEDE3', red: '#E63946',
};

const Field = ({ label, icon, ...props }: any) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 12.5, fontWeight: '800', color: LC.textMid, marginBottom: 7 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAF8', borderRadius: 14, borderWidth: 1.5, borderColor: LC.border, paddingHorizontal: 13 }}>
      <Ionicons name={icon} size={18} color={LC.primary} />
      <TextInput placeholderTextColor="#A7B3AB" style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: LC.text, fontWeight: '600' }} {...props} />
    </View>
  </View>
);

export default function Register() {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicle, setVehicle] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const findVehicle = async () => {
    const reg = vehicleNumber.trim().toUpperCase();
    if (reg.length < 6) { Alert.alert('Invalid number', 'Enter a valid vehicle number.'); return; }
    setFetching(true);
    try {
      const res = await api.post('/api/partner/verify-vehicle', { vehicleNumber: reg });
      if (res?.success) setVehicle(res.data.vehicle);
      else Alert.alert('Not found', res?.message || 'Could not fetch vehicle details');
    } catch { Alert.alert('Error', 'Check your connection and try again.'); }
    finally { setFetching(false); }
  };

  const sendOtp = async () => {
    if (!name.trim()) { Alert.alert('Name needed', 'Enter your full name.'); return; }
    if (phone.trim().length < 10) { Alert.alert('Invalid phone', 'Enter a valid 10-digit number.'); return; }
    setSending(true);
    try {
      const res = await api.post('/api/partner/send-otp', { phone: phone.trim() });
      if (res?.success) {
        router.push({ pathname: '/(auth)/otp', params: { mode: 'register', phone: phone.trim(), name: name.trim(), vehicleNumber: vehicleNumber.trim().toUpperCase(), devOtp: res.devOtp || '' } });
      } else Alert.alert('Error', res?.message || 'Could not send OTP');
    } catch { Alert.alert('Error', 'Something went wrong'); }
    finally { setSending(false); }
  };

  const cap = vehicle ? getVehicle(vehicle.vehicleType) : null;

  return (
    <View style={{ flex: 1, backgroundColor: LC.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: LC.green50, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={LC.dark} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 27, fontWeight: '900', color: LC.text }}>Become a partner</Text>
            <Text style={{ fontSize: 14, color: LC.textMid, marginTop: 6, marginBottom: 22 }}>Enter your vehicle number — we’ll fetch the rest from Vahan.</Text>

            {/* Vehicle number + lookup */}
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: LC.textMid, marginBottom: 7 }}>Vehicle Number Plate</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAF8', borderRadius: 14, borderWidth: 1.5, borderColor: vehicle ? LC.primary : LC.border, paddingHorizontal: 13 }}>
                <Ionicons name="card-outline" size={18} color={LC.primary} />
                <TextInput value={vehicleNumber} onChangeText={(t) => { setVehicleNumber(t.toUpperCase()); setVehicle(null); }} placeholder="UK 04 AB 1234" autoCapitalize="characters" placeholderTextColor="#A7B3AB"
                  style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: LC.text, fontWeight: '700', letterSpacing: 1 }} />
              </View>
              <TouchableOpacity onPress={findVehicle} disabled={fetching} style={{ paddingHorizontal: 16, borderRadius: 14, backgroundColor: LC.dark, alignItems: 'center', justifyContent: 'center' }}>
                {fetching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Find</Text>}
              </TouchableOpacity>
            </View>

            {/* Vehicle details card */}
            {vehicle && (
              <View style={{ marginTop: 16, backgroundColor: LC.green50, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: LC.green200 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name={(cap?.icon || 'car') as any} size={22} color={LC.primary} />
                    <Text style={{ fontSize: 15, fontWeight: '900', color: LC.text }}>{vehicle.maker} {vehicle.model}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: vehicle.verified ? LC.primary : LC.green200, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 }}>
                    <Ionicons name={vehicle.verified ? 'shield-checkmark' : 'information-circle'} size={12} color={vehicle.verified ? '#fff' : LC.dark} />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: vehicle.verified ? '#fff' : LC.dark }}>{vehicle.verified ? 'RC Verified' : 'Details'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {[['Class', vehicle.vehicleClass], ['Fuel', vehicle.fuelType || '—'], ['Carries', `${cap?.capacity} parcels`]].map(([k, v]) => (
                    <View key={k} style={{ backgroundColor: LC.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 9.5, color: LC.textSoft, fontWeight: '700' }}>{String(k).toUpperCase()}</Text>
                      <Text style={{ fontSize: 12.5, color: LC.text, fontWeight: '800' }} numberOfLines={1}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Name + phone (only after vehicle found) */}
            {vehicle && (
              <View style={{ marginTop: 22 }}>
                <Field label="Full Name" icon="person-outline" placeholder="e.g. Bhuvan Negi" value={name} onChangeText={setName} />
                <Field label="Phone Number" icon="call-outline" placeholder="10-digit mobile" keyboardType="phone-pad" value={phone} onChangeText={(t: string) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))} />
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {vehicle && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: LC.white, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: LC.border }}>
            <TouchableOpacity onPress={sendOtp} disabled={sending} activeOpacity={0.9} style={{ backgroundColor: LC.primary, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {sending ? <ActivityIndicator color="#fff" /> : <><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Send OTP</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
