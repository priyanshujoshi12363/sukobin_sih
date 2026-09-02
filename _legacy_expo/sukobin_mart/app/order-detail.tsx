import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';

const C = {
  green900: '#1A3D2B', green700: '#2D6A4F', green500: '#40916C', green400: '#52B788', green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', amber: '#F4A261', red: '#E63946', border: '#EFEDE6',
};
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STEPS = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'DELIVERED'];
const STEP_LABEL: Record<string, string> = { PLACED: 'Order placed', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY_FOR_PICKUP: 'Ready for pickup', DELIVERED: 'Delivered' };
const IDX: Record<string, number> = { PLACED: 0, ACCEPTED: 1, PREPARING: 2, READY_FOR_PICKUP: 3, PICKED: 3, ON_THE_WAY: 4, DELIVERED: 4 };

export default function OrderDetail() {
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await api.get(`/api/merchant/orders/${id}`);
      if (res?.success) setOrder(res.data?.order);
    } catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchOrder(); }, [fetchOrder]));

  const updateStatus = async (status: string, label: string) => {
    const run = async () => {
      setBusy(true);
      try {
        const res = await api.patch(`/api/merchant/orders/${id}/status`, { status });
        if (res?.success) setOrder(res.data?.order);
        else Alert.alert('Error', res?.message || 'Could not update');
      } catch { Alert.alert('Error', 'Something went wrong'); }
      finally { setBusy(false); }
    };
    if (status === 'CANCELLED') {
      Alert.alert('Cancel order?', 'The customer will be refunded if they paid.', [
        { text: 'No', style: 'cancel' }, { text: 'Yes, cancel', style: 'destructive', onPress: run },
      ]);
    } else run();
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={C.green500} /></View>;
  if (!order) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
      <Ionicons name="receipt-outline" size={54} color={C.green100} />
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, marginTop: 12 }}>Order not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18, backgroundColor: C.green500, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Back</Text></TouchableOpacity>
    </SafeAreaView>
  );

  const cancelled = order.orderStatus === 'CANCELLED';
  const cur = IDX[order.orderStatus] ?? 0;
  const addr = order.deliveryAddress || {};
  let action: any = null;
  if (order.orderStatus === 'PLACED') action = { status: 'ACCEPTED', label: 'Accept Order', icon: 'checkmark-circle' };
  else if (order.orderStatus === 'ACCEPTED') action = { status: 'PREPARING', label: 'Start Preparing', icon: 'cube' };
  else if (order.orderStatus === 'PREPARING') action = { status: 'READY_FOR_PICKUP', label: 'Mark Ready for Pickup', icon: 'bag-check' };
  const canCancel = ['PLACED', 'ACCEPTED', 'PREPARING'].includes(order.orderStatus);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={20} color={C.green900} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text }}>{order.orderId}</Text>
            <Text style={{ fontSize: 12, color: C.textSoft }}>{inr(order.totalAmount)} · {order.paymentStatus}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: action || canCancel ? 130 : 30 }}>
          {/* Status */}
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border }}>
            {cancelled ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={22} color={C.red} /></View>
                <View><Text style={{ fontSize: 16, fontWeight: '900', color: C.red }}>Order Cancelled</Text><Text style={{ fontSize: 12, color: C.textSoft }}>{order.paymentStatus === 'REFUNDED' ? 'Refund initiated' : ''}</Text></View>
              </View>
            ) : STEPS.map((s, i) => {
              const done = i <= cur, last = i === STEPS.length - 1;
              return (
                <View key={s} style={{ flexDirection: 'row' }}>
                  <View style={{ alignItems: 'center', width: 28 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? C.green500 : C.green100, alignItems: 'center', justifyContent: 'center' }}>
                      {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.textSoft }} />}
                    </View>
                    {!last && <View style={{ width: 2.5, flex: 1, minHeight: 22, backgroundColor: i < cur ? C.green500 : C.green100 }} />}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: done ? '800' : '600', color: done ? C.text : C.textSoft, marginLeft: 10, paddingBottom: last ? 0 : 14, paddingTop: 1 }}>{STEP_LABEL[s]}</Text>
                </View>
              );
            })}
          </View>

          {/* Items */}
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: C.border }}>
            <Text style={lbl}>Items</Text>
            {order.items?.map((it: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.green50 }}>
                <Text style={{ fontSize: 13.5, color: C.text, flex: 1 }} numberOfLines={1}>{it.name} × {it.quantity}</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.text }}>{inr(it.totalPrice)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: C.green100, marginVertical: 10 }} />
            <Row label="Item total" value={inr(order.subtotal)} />
            <Row label="Delivery (to partner)" value={inr(order.deliveryFee)} />
            <Row label="Platform fee" value={inr(order.platformFee)} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: C.text }}>Total paid</Text>
              <Text style={{ fontSize: 17, fontWeight: '900', color: C.green500 }}>{inr(order.totalAmount)}</Text>
            </View>
          </View>

          {/* Customer / delivery */}
          <View style={{ backgroundColor: C.white, borderRadius: 18, padding: 16, marginTop: 14, borderWidth: 1, borderColor: C.border }}>
            <Text style={lbl}>Deliver to</Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{order.user?.name || 'Customer'}</Text>
            <Text style={{ fontSize: 13, color: C.textMid, marginTop: 3, lineHeight: 19 }}>{addr.fullAddress}</Text>
            <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 1 }}>{[addr.village, addr.town, addr.district, addr.state].filter(Boolean).join(', ')} {addr.pincode}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Ionicons name="call-outline" size={14} color={C.green500} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{order.customerPhone}</Text>
            </View>
          </View>
        </ScrollView>

        {(action || canCancel) && !cancelled && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, flexDirection: 'row', gap: 10 }}>
            {canCancel && (
              <TouchableOpacity onPress={() => updateStatus('CANCELLED', 'Cancel')} disabled={busy} style={{ paddingHorizontal: 16, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: C.red, backgroundColor: '#FFF5F5' }}>
                <Ionicons name="close" size={18} color={C.red} />
              </TouchableOpacity>
            )}
            {action ? (
              <TouchableOpacity onPress={() => updateStatus(action.status, action.label)} disabled={busy} style={{ flex: 1, backgroundColor: C.green500, borderRadius: 14, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name={action.icon} size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>{action.label}</Text></>}
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1, backgroundColor: '#EDE9FE', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#6D28D9" />
                <Text style={{ color: '#6D28D9', fontWeight: '800' }}>Waiting for delivery partner</Text>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
    <Text style={{ fontSize: 13, color: C.textMid }}>{label}</Text>
    <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }}>{value}</Text>
  </View>
);
const lbl: any = { fontSize: 11, fontWeight: '800', color: '#9AA8A0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 };
