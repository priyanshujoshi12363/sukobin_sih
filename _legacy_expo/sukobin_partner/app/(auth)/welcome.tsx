import { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StatusBar, Image } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const LC = {
  primary: '#2D6A4F', dark: '#1A3D2B', green50: '#F0FAF3', green100: '#D8F3DC', green200: '#B7E4C7',
  green400: '#52B788', green500: '#40916C', bg2: '#E3F4E9',
  white: '#FFFFFF', text: '#1A3D2B', textMid: '#5B7A68', textSoft: '#7DAA90', border: '#DCEDE3', amber: '#E8962F',
};

const Feature = ({ icon, title, sub, delay }: any) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 450, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] }}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: LC.green50, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name={icon} size={22} color={LC.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: LC.text, fontSize: 15, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: LC.textSoft, fontSize: 12.5, marginTop: 1 }}>{sub}</Text>
      </View>
    </Animated.View>
  );
};

export default function Welcome() {
  const hero = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(hero, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }).start(); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: LC.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={LC.white} />
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {/* Hero card */}
          <Animated.View style={{ opacity: hero, transform: [{ scale: hero.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
            <View style={{ backgroundColor: LC.bg2, borderRadius: 28, padding: 24, marginBottom: 30, borderWidth: 1, borderColor: LC.green200 }}>
              <View style={{ width: 66, height: 66, borderRadius: 18, backgroundColor: LC.white, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: LC.green100, shadowColor: LC.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 8 }}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={{ width: '100%', height: '100%', transform: [{ scale: 1.5 }] }}
                  resizeMode="contain"
                />
              </View>
              <Text style={{ color: LC.dark, fontSize: 26, fontWeight: '900', lineHeight: 32 }}>Earn on{'\n'}your route.</Text>
              <Text style={{ color: LC.textMid, fontSize: 13.5, marginTop: 10, lineHeight: 20, fontWeight: '500' }}>
                Heading Haldwani → Almora anyway? Carry parcels going the same way and get paid.
              </Text>
            </View>
          </Animated.View>

          <View style={{ gap: 18 }}>
            <Feature icon="card-account-details-outline" title="Just your number plate" sub="We fetch your vehicle from Vahan" delay={150} />
            <Feature icon="map-marker-path" title="Pick your route" sub="See only parcels going your way" delay={280} />
            <Feature icon="cash-multiple" title="Get paid per drop" sub="Cash on delivery, instantly" delay={410} />
          </View>
        </View>

        <View style={{ paddingBottom: 24, gap: 12 }}>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.9}
            style={{ backgroundColor: LC.primary, borderRadius: 18, paddingVertical: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Become a Partner</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} activeOpacity={0.8} style={{ paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: LC.textMid, fontSize: 14.5, fontWeight: '700' }}>I already have an account · <Text style={{ color: LC.primary }}>Log in</Text></Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
