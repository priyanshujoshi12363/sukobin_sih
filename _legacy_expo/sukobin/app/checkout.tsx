import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, StatusBar, Animated, Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/utils/api';
import { openRazorpay } from '@/utils/payment';
import { useCart } from '@/_components/cartContext';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F4FBF6', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90',
  amber: '#F4A261', red: '#E63946',
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Card = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const a = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={{
      opacity: a,
      transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }],
      backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14,
      borderWidth: 1, borderColor: C.green100,
      shadowColor: C.green900, shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
    }}>
      {children}
    </Animated.View>
  );
};

const Row = ({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: bold ? 0 : 9 }}>
    <Text style={{ fontSize: bold ? 16 : 13.5, color: bold ? C.text : C.textMid, fontWeight: bold ? '900' : '500' }}>{label}</Text>
    <Text style={{ fontSize: bold ? 19 : 13.5, fontWeight: bold ? '900' : '700', color: accent ? C.green500 : C.text }}>{value}</Text>
  </View>
);

export default function CheckoutScreen() {
  const { clearCart } = useCart();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const payScale = useRef(new Animated.Value(1)).current;

  const fetchCheckout = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await api.post('/api/order/check-out', {});
      if (res?.success && res.checkout) {
        setData(res.checkout);
      } else {
        setError(res?.message || 'Could not load checkout');
      }
    } catch {
      setError('Something went wrong. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCheckout(); }, [fetchCheckout]));

  const handlePay = async () => {
    if (paying) return;
    setPaying(true);
    try {
      // 1. Create the server-priced Razorpay order
      const createRes = await api.post('/api/order/create', {});
      if (!createRes?.success) {
        Alert.alert('Payment', createRes?.message || 'Could not start payment');
        setPaying(false);
        return;
      }
      const d = createRes.data;

      // 2. Open the Razorpay sheet
      let result;
      try {
        result = await openRazorpay({
          key: d.key,
          amount: d.amount,
          currency: d.currency,
          order_id: d.razorpayOrderId,
          name: 'Sukobin',
          description: `Order ${d.orderId}`,
          prefill: { name: d.prefill?.name, contact: d.prefill?.contact },
          theme: { color: C.green900 },
        });
      } catch (rzpErr: any) {
        // user dismissed or native missing
        if (rzpErr?.code === 'NATIVE_MISSING') {
          Alert.alert('Razorpay not installed', rzpErr.description);
        } else {
          Alert.alert('Payment cancelled', 'You can complete the payment anytime.');
        }
        setPaying(false);
        return;
      }

      // 3. Verify on the server (signature + amount)
      const verifyRes = await api.post('/api/order/verify', {
        razorpay_order_id: result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature: result.razorpay_signature,
      });

      if (verifyRes?.success) {
        await clearCart();
        const order = verifyRes.data?.order;
        router.replace({
          pathname: '/order/success',
          params: {
            id: order?._id,
            orderId: order?.orderId,
            amount: String(order?.totalAmount ?? d.summary?.totalAmount ?? ''),
          },
        });
      } else {
        Alert.alert('Payment', verifyRes?.message || 'Payment could not be verified');
      }
    } catch {
      Alert.alert('Payment', 'Something went wrong during payment.');
    } finally {
      setPaying(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.green400} />
        <Text style={{ marginTop: 12, color: C.textSoft }}>Preparing your order…</Text>
      </View>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <Ionicons name="alert-circle-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 14 }}>Can’t checkout</Text>
        <Text style={{ color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{error}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.green200 }}>
            <Text style={{ color: C.green700, fontWeight: '700' }}>Go Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchCheckout} style={{ paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14, backgroundColor: C.green400 }}>
            <Text style={{ color: C.white, fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const addr = data.deliveryAddress || {};
  const addrLine = [addr.village, addr.town, addr.district, addr.state].filter(Boolean).join(', ');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={C.green900} />
          </TouchableOpacity>
          <Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>Checkout</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 160 }}>

          {/* Delivery address */}
          <Card delay={0}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="location-sharp" size={16} color={C.green500} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Delivery Address</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/edit-address', params: { data: JSON.stringify({ name: data.customer?.name, ...addr }) } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
              >
                <Ionicons name="create-outline" size={14} color={C.green500} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.green500 }}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{data.customer?.name}</Text>
            <Text style={{ fontSize: 13, color: C.textMid, marginTop: 3, lineHeight: 19 }}>{addr.fullAddress}</Text>
            {!!addrLine && <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 1 }}>{addrLine} {addr.pincode}</Text>}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="call-outline" size={12} color={C.textSoft} />
              <Text style={{ fontSize: 12.5, color: C.textSoft }}>{data.customer?.phone}</Text>
            </View>
          </Card>

          {/* Items */}
          <Card delay={70}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {data.shop?.shopLogo
                ? <Image source={{ uri: data.shop.shopLogo }} style={{ width: 30, height: 30, borderRadius: 10 }} />
                : <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="storefront" size={15} color={C.green500} /></View>}
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, flex: 1 }} numberOfLines={1}>{data.shop?.shopName}</Text>
              <Text style={{ fontSize: 12, color: C.textSoft }}>{data.totalItems} item{data.totalItems > 1 ? 's' : ''}</Text>
            </View>
            {data.items?.map((it: any, idx: number) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: C.green50 }}>
                <Image source={{ uri: it.image || 'https://via.placeholder.com/80' }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: C.green50 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text }} numberOfLines={1}>{it.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textSoft }}>{inr(it.price)} × {it.quantity}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{inr(it.totalPrice)}</Text>
              </View>
            ))}
          </Card>

          {/* Bill */}
          <Card delay={140}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Bill Details</Text>
            <Row label="Item total" value={inr(data.subtotal)} />
            <Row label={`Delivery fee${data.distance ? ` · ${data.distance} km` : ''}`} value={inr(data.deliveryFee)} />
            <Row label="Platform fee" value={inr(data.platformFee)} />
            <View style={{ height: 1, backgroundColor: C.green100, marginVertical: 10 }} />
            <Row label="To Pay" value={inr(data.totalAmount)} bold accent />
          </Card>

          {/* Payment method */}
          <Card delay={200}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark" size={18} color={C.green500} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Pay securely with Razorpay</Text>
                <Text style={{ fontSize: 12, color: C.textSoft, marginTop: 1 }}>UPI · Cards · NetBanking · Wallets</Text>
              </View>
              <Ionicons name="lock-closed" size={16} color={C.green400} />
            </View>
          </Card>
        </ScrollView>

        {/* Sticky pay bar */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white,
          borderTopWidth: 1, borderTopColor: C.green100, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28,
          shadowColor: C.green900, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 14,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '700' }}>TOTAL PAYABLE</Text>
              <Text style={{ fontSize: 23, fontWeight: '900', color: C.green900 }}>{inr(data.totalAmount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="lock-closed" size={12} color={C.textSoft} />
              <Text style={{ fontSize: 11, color: C.textSoft }}>100% Secure</Text>
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: payScale }] }}>
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={paying}
              onPressIn={() => Animated.spring(payScale, { toValue: 0.97, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(payScale, { toValue: 1, useNativeDriver: true }).start()}
              onPress={handlePay}
              style={{
                backgroundColor: C.green400, borderRadius: 16, paddingVertical: 16,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                shadowColor: C.green700, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
                opacity: paying ? 0.85 : 1,
              }}
            >
              {paying
                ? <><ActivityIndicator size="small" color={C.white} /><Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>Processing…</Text></>
                : <><Ionicons name="lock-closed" size={17} color={C.white} /><Text style={{ color: C.white, fontWeight: '900', fontSize: 16 }}>Pay {inr(data.totalAmount)}</Text></>}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
