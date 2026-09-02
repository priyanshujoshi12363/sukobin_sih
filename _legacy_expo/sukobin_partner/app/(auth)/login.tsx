import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';

const LC = {
  primary: '#2D6A4F', dark: '#1A3D2B', green50: '#F0FAF3', green100: '#D8F3DC',
  white: '#FFFFFF', text: '#1A3D2B', textMid: '#5B7A68', textSoft: '#7DAA90', border: '#DCEDE3',
};

export default function Login() {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);

  const sendOtp = async () => {
    if (phone.trim().length < 10) { Alert.alert('Invalid number', 'Enter a valid 10-digit mobile number.'); return; }
    setSending(true);
    try {
      const res = await api.post('/api/partner/send-otp', { phone: phone.trim() });
      if (res?.success) {
        router.push({ pathname: '/(auth)/otp', params: { mode: 'login', phone: phone.trim(), devOtp: res.devOtp || '' } });
      } else Alert.alert('Error', res?.message || 'Could not send OTP');
    } catch { Alert.alert('Error', 'Something went wrong'); }
    finally { setSending(false); }
  };

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
          <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: LC.dark, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <MaterialCommunityIcons name="steering" size={32} color="#fff" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: LC.text }}>Welcome back</Text>
            <Text style={{ fontSize: 14.5, color: LC.textMid, marginTop: 6, marginBottom: 30 }}>Log in with your registered mobile number.</Text>

            <Text style={{ fontSize: 12.5, fontWeight: '800', color: LC.textMid, marginBottom: 8 }}>Phone Number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7FAF8', borderRadius: 16, borderWidth: 1.5, borderColor: LC.border, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: LC.text }}>+91</Text>
              <View style={{ width: 1, height: 22, backgroundColor: LC.border, marginHorizontal: 12 }} />
              <TextInput placeholder="10-digit mobile" placeholderTextColor="#A7B3AB" keyboardType="phone-pad" value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 10))}
                style={{ flex: 1, paddingVertical: 16, fontSize: 16, color: LC.text, fontWeight: '700', letterSpacing: 1 }} />
            </View>

            <TouchableOpacity onPress={sendOtp} disabled={sending} activeOpacity={0.9} style={{ marginTop: 26, backgroundColor: LC.primary, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {sending ? <ActivityIndicator color="#fff" /> : <><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Send OTP</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/register')} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: LC.textMid, fontWeight: '600' }}>New here? <Text style={{ color: LC.primary, fontWeight: '800' }}>Become a partner</Text></Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
