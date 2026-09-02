import './global.css';
import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing } from 'react-native';
import { Redirect } from 'expo-router';
import { C } from '@/lib/data';
import { verifySession, clearSession } from '@/lib/api';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [dest, setDest] = useState<'/(tabs)/home' | '/(auth)/welcome'>('/(auth)/welcome');

  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();

    (async () => {
      // verify the JWT with the backend, but keep the splash up for a beat
      const [result] = await Promise.all([
        verifySession(),
        new Promise((r) => setTimeout(r, 1100)),
      ]);

      if (result.status === 'authenticated' || result.status === 'offline') {
        // valid token (or just no network) → go straight to the dashboard
        setDest('/(tabs)/home');
      } else {
        // 'invalid' → token expired / blocked / deleted: wipe it. 'unauthenticated' → never logged in.
        if (result.status === 'invalid') await clearSession();
        setDest('/(auth)/welcome');
      }
      setReady(true);
    })();
  }, []);

  if (ready) return <Redirect href={dest} />;

  const pulse = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.85] });
  const pulseOp = ring.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: C.green400, opacity: pulseOp, transform: [{ scale: pulse }] }} />
        <Animated.View
          style={{
            width: 116, height: 116, borderRadius: 34, backgroundColor: C.white, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center', opacity, transform: [{ scale }],
            borderWidth: 1, borderColor: C.green100,
            shadowColor: C.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 12,
          }}
        >
          <Image
            source={require('../assets/images/logo.png')}
            style={{ width: '100%', height: '100%', transform: [{ scale: 1.55 }] }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
      <Animated.View style={{ opacity, alignItems: 'center', marginTop: 26 }}>
        <Text style={{ color: C.green900, fontSize: 26, fontWeight: '900', letterSpacing: 0.5 }}>Sukobin <Text style={{ color: C.green500 }}>Partner</Text></Text>
        <Text style={{ color: C.textSoft, fontSize: 13, marginTop: 6, fontWeight: '600' }}>Drive your route • Earn on the way</Text>
      </Animated.View>
    </View>
  );
}
