import { useEffect, useState, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StatusBar } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/service/api';

const C = {
  green900: '#1A3D2B', green700: '#2D6A4F', green500: '#40916C', green400: '#52B788',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3', white: '#FFFFFF', textSoft: '#7DAA90',
};

export default function Index() {
  const [ready, setReady] = useState(false);
  const [dest, setDest] = useState<string>('/(auth)/welcome');

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const float = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(ring, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true })).start();
    Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true })).start();

    const t = setTimeout(checkAuth, 1300);
    return () => clearTimeout(t);
  }, []);

  const checkAuth = async () => {
    try {
      const partial = await AsyncStorage.getItem('partialMerchantData');
      if (partial) { setDest('/(auth)/register-otp'); return; }
      const token = await AsyncStorage.getItem('merchantToken');
      if (!token) { setDest('/(auth)/welcome'); return; }
      const res = await api.get('/api/merchant/verify');
      if (res?.success) setDest('/(tabs)/home');
      else {
        await AsyncStorage.multiRemove(['merchantToken', 'merchantData']);
        setDest('/(auth)/welcome');
      }
    } catch {
      setDest('/(auth)/welcome');
    } finally {
      setReady(true);
    }
  };

  if (ready) return <Redirect href={dest as any} />;

  const TRACK = 150, SEG = 56;
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SEG, TRACK] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const pulseScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOp = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.green50} />

      {/* soft decorative blobs */}
      <View style={{ position: 'absolute', top: -70, right: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: C.green100, opacity: 0.7 }} />
      <View style={{ position: 'absolute', bottom: -90, left: -90, width: 280, height: 280, borderRadius: 140, backgroundColor: C.green200, opacity: 0.35 }} />

      <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ scale }] }}>
        <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center', justifyContent: 'center' }}>
          {/* pulse halo */}
          <Animated.View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 40, backgroundColor: C.green400, opacity: pulseOp, transform: [{ scale: pulseScale }] }} />
          {/* logo card */}
          <View style={{ borderRadius: 40, shadowColor: C.green900, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 }}>
            <View style={{ width: 150, height: 150, borderRadius: 40, backgroundColor: C.white, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../assets/images/logo.png')} style={{ width: '100%', height: '100%', transform: [{ scale: 1.3 }] }} resizeMode="contain" />
            </View>
          </View>
        </Animated.View>

        <Text style={{ fontSize: 30, fontWeight: '900', color: C.green900, letterSpacing: -0.5, marginTop: 32 }}>Sukobin</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 }}>
          <View style={{ width: 16, height: 1.5, backgroundColor: C.green200 }} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.green500, letterSpacing: 2, textTransform: 'uppercase' }}>Merchant</Text>
          <View style={{ width: 16, height: 1.5, backgroundColor: C.green200 }} />
        </View>
      </Animated.View>

      {/* sweeping progress bar */}
      <Animated.View style={{ position: 'absolute', bottom: 80, alignItems: 'center', opacity: fade }}>
        <View style={{ width: TRACK, height: 4, borderRadius: 2, backgroundColor: C.green100, overflow: 'hidden' }}>
          <Animated.View style={{ width: SEG, height: 4, borderRadius: 2, backgroundColor: C.green500, transform: [{ translateX: sweepX }] }} />
        </View>
        <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 12, fontWeight: '600' }}>Loading your store…</Text>
      </Animated.View>
    </View>
  );
}
