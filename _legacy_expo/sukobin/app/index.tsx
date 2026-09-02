import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useRef } from "react";
import { View, Text, Image, Animated, Easing, StatusBar } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import api from "@/utils/api";

const C = {
  bg: '#F4FBF6',
  bg2: '#E3F4E9',
  white: '#FFFFFF',
  green900: '#1A3D2B',
  green700: '#2D6A4F',
  green500: '#40916C',
  green400: '#52B788',
  green200: '#B7E4C7',
  green100: '#D8F3DC',
  textSoft: '#7DAA90',
};

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textShift = useRef(new Animated.Value(12)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ringPulse = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(ring1, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 500, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(textShift, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(barOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // gentle breathing pulse on the outer ring
    Animated.loop(Animated.sequence([
      Animated.timing(ringPulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(ringPulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    // indeterminate sweeping progress bar
    Animated.loop(Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true })).start();

    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (!token) { setIsLoggedIn(false); setLoading(false); return; }
      setIsVerifying(true);
      const response = await api.post("/api/user/verify", {});
      if (response.success) {
        setIsLoggedIn(true);
      } else {
        await AsyncStorage.removeItem("userToken");
        await AsyncStorage.removeItem("userData");
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setIsLoggedIn(false);
    } finally {
      setIsVerifying(false);
      setLoading(false);
    }
  };

  if (loading || isVerifying) {
    const TRACK = 150, SEG = 56;
    const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SEG, TRACK] });
    const pulseScale = ringPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
    const pulseOpacity = ringPulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.12] });

    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <LinearGradient colors={[C.bg, C.bg2]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>

          {/* decorative soft blobs */}
          <View style={{ position: 'absolute', top: -70, right: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: C.green100, opacity: 0.55 }} />
          <View style={{ position: 'absolute', bottom: -90, left: -90, width: 280, height: 280, borderRadius: 140, backgroundColor: C.green200, opacity: 0.35 }} />

          {/* rings + logo */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1.5, borderColor: C.green200, opacity: Animated.multiply(ring1, pulseOpacity), transform: [{ scale: Animated.multiply(ring1, pulseScale) }] }} />
            <Animated.View style={{ position: 'absolute', width: 162, height: 162, borderRadius: 81, borderWidth: 1.5, borderColor: C.green200, opacity: ring2, transform: [{ scale: ring2 }] }} />

            <Animated.View style={{
              width: 112, height: 112, borderRadius: 34, backgroundColor: C.white,
              borderWidth: 1, borderColor: C.green100,
              alignItems: 'center', justifyContent: 'center',
              opacity: logoOpacity, transform: [{ scale: logoScale }],
              shadowColor: C.green900, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12,
            }}>
              <Image source={require('../assets/icon.png')} style={{ width: 74, height: 74 }} resizeMode="contain" />
            </Animated.View>
          </View>

          {/* wordmark */}
          <Animated.View style={{ alignItems: 'center', marginTop: 38, opacity: textOpacity, transform: [{ translateY: textShift }] }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: C.green900, letterSpacing: -0.8 }}>Sukobin</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <View style={{ width: 16, height: 1.5, backgroundColor: C.green200 }} />
              <Text style={{ fontSize: 12.5, color: C.textSoft, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' }}>Hills • Delivered</Text>
              <View style={{ width: 16, height: 1.5, backgroundColor: C.green200 }} />
            </View>
          </Animated.View>

          {/* sweeping progress bar */}
          <Animated.View style={{ marginTop: 50, alignItems: 'center', opacity: barOpacity }}>
            <View style={{ width: TRACK, height: 4, borderRadius: 2, backgroundColor: C.green100, overflow: 'hidden' }}>
              <Animated.View style={{ width: SEG, height: 4, borderRadius: 2, backgroundColor: C.green400, transform: [{ translateX: sweepX }] }} />
            </View>
            <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 12, fontWeight: '600' }}>
              {isVerifying ? 'Verifying your session…' : 'Getting things ready…'}
            </Text>
          </Animated.View>

          {/* footer */}
          <View style={{ position: 'absolute', bottom: 36, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '500', opacity: 0.8 }}>Made for the hills of Uttarakhand</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (isLoggedIn) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/(auth)/welcome" />;
}
