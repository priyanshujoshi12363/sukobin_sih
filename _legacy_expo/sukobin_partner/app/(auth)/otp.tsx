import { useRef, useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import { PartnerNotifications } from '@/lib/notify';

const LC = {
  primary: '#2D6A4F', dark: '#1A3D2B', green50: '#F0FAF3', green100: '#D8F3DC', green200: '#B7E4C7',
  white: '#FFFFFF', text: '#1A3D2B', textMid: '#5B7A68', textSoft: '#7DAA90', border: '#DCEDE3', amber: '#B7791F',
};
const LEN = 6;

export default function Otp() {
  const { mode, phone, name, vehicleNumber, devOtp } = useLocalSearchParams();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [timer, setTimer] = useState(30);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => { const id = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000); return () => clearInterval(id); }, []);

  const onChange = (val: string, i: number) => {
    const v = val.replace(/[^0-9]/g, '');
    const next = [...digits]; next[i] = v.slice(-1); setDigits(next);
    if (v && i < LEN - 1) inputs.current[i + 1]?.focus();
  };
  const onKey = (e: any, i: number) => { if (e.nativeEvent.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus(); };

  const verify = async () => {
    const code = digits.join('');
    if (code.length < LEN) { Alert.alert('Enter OTP', 'Please enter the full 6-digit code.'); return; }
    setVerifying(true);
    try {
      const endpoint = mode === 'register' ? '/api/partner/register' : '/api/partner/login';
      const body = mode === 'register'
        ? { vehicleNumber, name, phone, otp: code }
        : { phone, otp: code };
      const res = await api.post(endpoint, body);
      if (res?.success && res.token) {
        await AsyncStorage.setItem('partnerToken', res.token);
        await AsyncStorage.setItem('partnerData', JSON.stringify(res.partner));
        PartnerNotifications.register();
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('Verification failed', res?.message || 'Invalid OTP');
        setVerifying(false);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong');
      setVerifying(false);
    }
  };

  const resend = async () => {
    try { const res = await api.post('/api/partner/send-otp', { phone }); if (res?.success) { setTimer(30); Alert.alert('OTP sent', res.devOtp ? `Demo code: ${res.devOtp}` : 'Check your messages.'); } } catch {}
  };

  const filled = digits.every((d) => d);

  return (
    <View style={{ flex: 1, backgroundColor: LC.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.white} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: LC.green50, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={LC.dark} />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 26, paddingTop: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: LC.text }}>Verify number</Text>
          <Text style={{ fontSize: 14.5, color: LC.textMid, marginTop: 6 }}>
            Enter the 6-digit code sent to <Text style={{ fontWeight: '800', color: LC.text }}>+91 {String(phone)}</Text>
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 34 }}>
            {digits.map((d, i) => (
              <TextInput key={i} ref={(r) => { inputs.current[i] = r; }} value={d} onChangeText={(v) => onChange(v, i)} onKeyPress={(e) => onKey(e, i)} keyboardType="number-pad" maxLength={1}
                style={{ width: 48, height: 58, borderRadius: 14, textAlign: 'center', fontSize: 22, fontWeight: '900', color: LC.text, backgroundColor: '#F7FAF8', borderWidth: 2, borderColor: d ? LC.primary : LC.border }} />
            ))}
          </View>

          <TouchableOpacity onPress={verify} disabled={!filled || verifying} activeOpacity={0.9}
            style={{ marginTop: 30, backgroundColor: filled ? LC.primary : LC.green200, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {verifying ? <ActivityIndicator color="#fff" /> : <><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{mode === 'register' ? 'Verify & Register' : 'Verify & Log in'}</Text><Ionicons name="checkmark-circle" size={18} color="#fff" /></>}
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginTop: 22 }}>
            {timer > 0
              ? <Text style={{ fontSize: 13.5, color: LC.textSoft }}>Resend code in 0:{String(timer).padStart(2, '0')}</Text>
              : <TouchableOpacity onPress={resend}><Text style={{ fontSize: 14, color: LC.primary, fontWeight: '800' }}>Resend OTP</Text></TouchableOpacity>}
          </View>

          {!!devOtp && (
            <View style={{ marginTop: 24, backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="information-circle" size={16} color={LC.amber} />
              <Text style={{ fontSize: 12.5, color: LC.amber, flex: 1, fontWeight: '700' }}>Demo OTP: {String(devOtp)}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
