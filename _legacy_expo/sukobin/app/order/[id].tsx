import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, StatusBar, Animated, Alert, RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/utils/api';

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F4FBF6', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90',
  amber: '#F4A261', red: '#E63946',
};

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STEPS = [
  { key: 'PLACED', label: 'Order Placed', icon: 'receipt-outline' },
  { key: 'ACCEPTED', label: 'Accepted by Store', icon: 'checkmark-circle-outline' },
  { key: 'PREPARING', label: 'Preparing', icon: 'cube-outline' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', icon: 'bag-handle-outline' },
  { key: 'ON_THE_WAY', label: 'On the Way', icon: 'bicycle-outline' },
  { key: 'DELIVERED', label: 'Delivered', icon: 'home-outline' },
] as const;

const ORDER_INDEX: Record<string, number> = {
  PENDING: 0, PLACED: 0, ACCEPTED: 1, PREPARING: 2,
  READY_FOR_PICKUP: 3, PICKED: 4, ON_THE_WAY: 4, DELIVERED: 5,
};

const PAYMENT_BADGE: Record<string, { c: string; bg: string }> = {
  PAID: { c: '#166534', bg: '#DDFBE6' },
  PENDING: { c: '#92400E', bg: '#FEF3C7' },
  FAILED: { c: '#991B1B', bg: '#FEE2E2' },
  REFUNDED: { c: '#3730A3', bg: '#E0E7FF' },
};

const TimelineStep = ({ step, idx, current, cancelled }: any) => {
  const done = idx <= current;
  const isCurrent = idx === current && !cancelled;
  const a = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 320, delay: idx * 90, useNativeDriver: true }).start();
    if (isCurrent) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [isCurrent]);

  const dotColor = cancelled ? C.green200 : done ? C.green400 : C.green100;
  const isLast = idx === STEPS.length - 1;

  return (
    <Animated.View style={{ flexDirection: 'row', opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }] }}>
      {/* dot + line */}
      <View style={{ alignItems: 'center', width: 36 }}>
        <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
          {isCurrent && (
            <Animated.View style={{ position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: C.green400 + '30', transform: [{ scale: pulse }] }} />
          )}
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: dotColor, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={(done ? 'checkmark' : step.icon) as any} size={done ? 15 : 13} color={done ? C.white : C.textSoft} />
          </View>
        </View>
        {!isLast && <View style={{ width: 2.5, flex: 1, minHeight: 26, backgroundColor: idx < current && !cancelled ? C.green400 : C.green100, borderRadius: 2 }} />}
      </View>
      {/* label */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingTop: 3 }}>
        <Text style={{ fontSize: 14, fontWeight: done ? '800' : '600', color: done ? C.text : C.textSoft }}>{step.label}</Text>
        {isCurrent && <Text style={{ fontSize: 12, color: C.green500, fontWeight: '600', marginTop: 2 }}>In progress…</Text>}
      </View>
    </Animated.View>
  );
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get(`/api/order/${id}`);
      if (res?.success) setOrder(res.data?.order);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchOrder(); }, [fetchOrder]));

  const handleCancel = () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order? Paid amount will be refunded.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
          setCancelling(true);
          try {
            const res = await api.patch(`/api/order/${id}/cancel`, {});
            if (res?.success) { setOrder(res.data?.order); }
            else Alert.alert('Error', res?.message || 'Could not cancel');
          } catch { Alert.alert('Error', 'Something went wrong'); }
          finally { setCancelling(false); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.green400} />
      </View>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
        <Ionicons name="receipt-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 14 }}>Order not found</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/orders')} style={{ marginTop: 22, paddingHorizontal: 26, paddingVertical: 12, backgroundColor: C.green400, borderRadius: 14 }}>
          <Text style={{ color: C.white, fontWeight: '800' }}>My Orders</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const cancelled = order.orderStatus === 'CANCELLED';
  const current = ORDER_INDEX[order.orderStatus] ?? 0;
  const canCancel = ['PENDING', 'PLACED', 'ACCEPTED', 'PREPARING'].includes(order.orderStatus);
  const addr = order.deliveryAddress || {};
  const pb = PAYMENT_BADGE[order.paymentStatus] || PAYMENT_BADGE.PENDING;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={C.green900} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>Order Details</Text>
            <Text style={{ fontSize: 12, color: C.textSoft }}>{order.orderId}</Text>
          </View>
          <View style={{ backgroundColor: pb.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: pb.c }}>{order.paymentStatus}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 130 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrder(); }} tintColor={C.green400} />}
        >
          {/* Status */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.green100 }}>
            {cancelled ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={24} color={C.red} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: C.red }}>Order Cancelled</Text>
                  <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>
                    {order.paymentStatus === 'REFUNDED' ? 'Your payment has been refunded.' : 'This order was cancelled.'}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>Order Status</Text>
                {STEPS.map((s, i) => <TimelineStep key={s.key} step={s} idx={i} current={current} cancelled={cancelled} />)}
              </>
            )}
          </View>

          {/* Items */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.green100 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              {order.shop?.shopLogo
                ? <Image source={{ uri: order.shop.shopLogo }} style={{ width: 28, height: 28, borderRadius: 9 }} />
                : <Ionicons name="storefront" size={18} color={C.green500} />}
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{order.shop?.shopName || 'Store'}</Text>
            </View>
            {order.items?.map((it: any, idx: number) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: C.green50 }}>
                <Image source={{ uri: it.image || 'https://via.placeholder.com/80' }} style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: C.green50 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.text }} numberOfLines={1}>{it.name}</Text>
                  <Text style={{ fontSize: 12, color: C.textSoft }}>{inr(it.price)} × {it.quantity}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{inr(it.totalPrice)}</Text>
              </View>
            ))}
          </View>

          {/* Delivery address */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.green100 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="location-sharp" size={16} color={C.green500} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>Delivery Address</Text>
            </View>
            <Text style={{ fontSize: 13, color: C.textMid, lineHeight: 19 }}>{addr.fullAddress}</Text>
            <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>
              {[addr.village, addr.town, addr.district, addr.state].filter(Boolean).join(', ')} {addr.pincode}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="call-outline" size={12} color={C.textSoft} />
              <Text style={{ fontSize: 12.5, color: C.textSoft }}>{order.customerPhone}</Text>
            </View>
          </View>

          {/* Bill */}
          <View style={{ backgroundColor: C.white, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.green100 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Bill Details</Text>
            <Bill label="Item total" value={inr(order.subtotal)} />
            <Bill label="Delivery fee" value={inr(order.deliveryFee)} />
            <Bill label="Platform fee" value={inr(order.platformFee)} />
            <View style={{ height: 1, backgroundColor: C.green100, marginVertical: 10 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>Total Paid</Text>
              <Text style={{ fontSize: 19, fontWeight: '900', color: C.green500 }}>{inr(order.totalAmount)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Cancel bar */}
        {canCancel && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.green100, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28 }}>
            <TouchableOpacity
              onPress={handleCancel}
              disabled={cancelling}
              activeOpacity={0.9}
              style={{ borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.red, backgroundColor: '#FFF5F5' }}
            >
              {cancelling
                ? <ActivityIndicator size="small" color={C.red} />
                : <><Ionicons name="close-circle-outline" size={18} color={C.red} /><Text style={{ color: C.red, fontWeight: '800', fontSize: 15 }}>Cancel Order</Text></>}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const Bill = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
    <Text style={{ fontSize: 13.5, color: C.textMid }}>{label}</Text>
    <Text style={{ fontSize: 13.5, fontWeight: '700', color: C.text }}>{value}</Text>
  </View>
);
