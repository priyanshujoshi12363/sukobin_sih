import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Animated, Easing } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F4FBF6', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90',
};

export default function OrderSuccessScreen() {
  const { id, orderId, amount } = useLocalSearchParams();

  const ring = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(ring, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.spring(check, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.timing(content, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
    ])).start();
  }, []);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Animated success ring */}
      <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        <Animated.View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: C.green400, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }} />
        <Animated.View style={{
          width: 110, height: 110, borderRadius: 55, backgroundColor: C.green400,
          alignItems: 'center', justifyContent: 'center',
          opacity: ring, transform: [{ scale: ring }],
          shadowColor: C.green500, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
        }}>
          <Animated.View style={{ transform: [{ scale: check }] }}>
            <Ionicons name="checkmark-sharp" size={64} color={C.white} />
          </Animated.View>
        </Animated.View>
      </View>

      <Animated.View style={{ alignItems: 'center', opacity: content, transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: C.text }}>Order Placed!</Text>
        <Text style={{ fontSize: 14, color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
          Your payment was successful and your order is confirmed. The store has been notified.
        </Text>

        <View style={{ flexDirection: 'row', gap: 22, marginTop: 24, backgroundColor: C.white, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 24, borderWidth: 1, borderColor: C.green100 }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textSoft, fontWeight: '700', letterSpacing: 0.5 }}>ORDER ID</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, marginTop: 3 }}>{orderId || '—'}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.green100 }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textSoft, fontWeight: '700', letterSpacing: 0.5 }}>PAID</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.green500, marginTop: 3 }}>₹{Number(amount || 0).toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ width: '100%', marginTop: 36, opacity: content }}>
        <TouchableOpacity
          onPress={() => router.replace({ pathname: '/order/[id]', params: { id: String(id) } })}
          activeOpacity={0.9}
          style={{ backgroundColor: C.green400, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Ionicons name="navigate" size={18} color={C.white} />
          <Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>Track Order</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.8}
          style={{ paddingVertical: 15, alignItems: 'center', marginTop: 6 }}
        >
          <Text style={{ color: C.green700, fontWeight: '800', fontSize: 15 }}>Continue Shopping</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
