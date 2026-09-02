import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar,
  Modal, Pressable, TextInput, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { C, Job } from '@/lib/data';
import { tripStore } from '@/lib/tripStore';
import { api } from '@/lib/api';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// open the device's maps app for turn-by-turn (no in-app map → no crash)
const navigateTo = (coords?: [number, number]) => {
  if (!coords) return;
  const [lng, lat] = coords;
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`).catch(() => {});
};
const callPhone = (phone?: string) => {
  if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
};

export default function Trip() {
  const trip = tripStore.get();
  const headerLabel = trip ? `${trip.from} → ${trip.to}` : 'Active deliveries';

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [earned, setEarned] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);

  const [otpFor, setOtpFor] = useState<Job | null>(null);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // server is the source of truth — survives crashes / app restarts
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/partner/trip/active');
        if (res?.success) setJobs(res.jobs || []);
      } catch {
        // keep whatever we had
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const confirmPicked = (job: Job) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setJobs((prev) => prev.map((j) => (j.refId === job.refId ? { ...j, picked: true } : j)));
    api.post('/api/partner/trip/picked', { kind: job.kind, id: job.refId }).catch(() => {});
  };

  const confirmDeliver = async () => {
    if (!otpFor || submitting) return;
    if (otp.length < 4) { Alert.alert('Enter OTP', 'Ask the customer for the 4-digit delivery code.'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/api/partner/trip/deliver', { kind: otpFor.kind, id: otpFor.refId, otp });
      if (res?.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setEarned((e) => e + (otpFor.fee || 0));
        setDeliveredCount((c) => c + 1);
        setJobs((prev) => prev.filter((j) => j.refId !== otpFor.refId));
        setOtpFor(null);
        setOtp('');
      } else {
        Alert.alert('Not delivered', res?.message || 'Incorrect OTP — check with the customer.');
      }
    } catch {
      Alert.alert('Network error', 'Could not confirm delivery. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => { tripStore.set(null); router.replace('/(tabs)/home'); };

  // ── Loading ──
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={{ marginTop: 12, color: C.textMid, fontWeight: '600' }}>Loading your deliveries…</Text>
      </View>
    );
  }

  // ── Trip complete (delivered everything this session) ──
  if (jobs.length === 0 && deliveredCount > 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Ionicons name="checkmark-sharp" size={60} color="#fff" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: C.text }}>All delivered! 🎉</Text>
        <View style={{ flexDirection: 'row', gap: 26, marginTop: 24, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 28, borderWidth: 1, borderColor: C.border }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textSoft, fontWeight: '700' }}>EARNED</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.primary, marginTop: 3 }}>{inr(earned)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: C.border }} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: C.textSoft, fontWeight: '700' }}>DELIVERED</Text>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, marginTop: 3 }}>{deliveredCount}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={finish} style={{ marginTop: 30, backgroundColor: C.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 60 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Nothing active ──
  if (jobs.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <MaterialCommunityIcons name="truck-remove-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.text, marginTop: 14 }}>No active deliveries</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 20, backgroundColor: C.primary, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Find deliveries</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = jobs.length + deliveredCount;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
      <View style={{ backgroundColor: C.bg2, paddingBottom: 22, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 18, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => router.replace('/(tabs)/home')} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.green200 }}>
              <Ionicons name="arrow-back" size={20} color={C.green900} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.green900, fontSize: 18, fontWeight: '900' }}>Active Trip</Text>
              <Text style={{ color: C.textMid, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{headerLabel}</Text>
            </View>
            <View style={{ backgroundColor: C.white, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: C.green200 }}>
              <Text style={{ color: C.primary, fontSize: 12, fontWeight: '800' }}>{deliveredCount}/{total}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* progress summary */}
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '700' }}>EARNED</Text><Text style={{ fontSize: 19, fontWeight: '900', color: C.primary }}>{inr(earned)}</Text></View>
          <View><Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '700' }}>STOPS LEFT</Text><Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>{jobs.length}</Text></View>
          <View><Text style={{ fontSize: 11, color: C.textSoft, fontWeight: '700' }}>DELIVERED</Text><Text style={{ fontSize: 19, fontWeight: '900', color: C.text }}>{deliveredCount}</Text></View>
        </View>

        {jobs.map((j, i) => {
          const isOrder = j.kind === 'order';
          const target = j.picked ? j.drop : j.pickup;
          return (
            <View key={`${j.kind}-${j.refId}`} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 11, borderWidth: 1.5, borderColor: j.picked ? C.primary : C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: C.primary }}>{i + 1}</Text>
                  </View>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ backgroundColor: isOrder ? '#EAF3FF' : C.green100, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 5 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: isOrder ? '#2563EB' : C.primaryDark }}>{isOrder ? 'ORDER' : 'PARCEL'}</Text>
                      </View>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.text }}>{j.refId}</Text>
                    </View>
                  </View>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: C.primary }}>{inr(j.fee)}</Text>
              </View>

              {/* pickup → drop */}
              <Text style={{ fontSize: 12.5, color: j.picked ? C.textSoft : C.text, fontWeight: j.picked ? '500' : '700', marginBottom: 2 }} numberOfLines={1}>⬆ {j.pickup.label}</Text>
              <Text style={{ fontSize: 12.5, color: j.picked ? C.text : C.textMid, fontWeight: j.picked ? '700' : '500' }} numberOfLines={1}>📍 {j.drop.label}</Text>
              {j.etaMin ? <Text style={{ fontSize: 12, color: C.textSoft, marginTop: 4 }}>~{j.etaMin} min{j.routeKm ? ` · ${j.routeKm} km` : ''}</Text> : null}

              {/* action row: navigate + call + primary */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity onPress={() => navigateTo(target?.coordinates)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: C.green50, borderRadius: 12, paddingVertical: 11, borderWidth: 1, borderColor: C.green200 }}>
                  <Ionicons name="navigate" size={15} color={C.primary} />
                  <Text style={{ color: C.primary, fontWeight: '800', fontSize: 13 }}>Navigate</Text>
                </TouchableOpacity>
                {target?.phone ? (
                  <TouchableOpacity onPress={() => callPhone(target.phone)} style={{ width: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green50, borderRadius: 12, borderWidth: 1, borderColor: C.green200 }}>
                    <Ionicons name="call" size={16} color={C.primary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {!j.picked ? (
                <TouchableOpacity onPress={() => confirmPicked(j)} style={{ marginTop: 9, backgroundColor: C.amber, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="package-up" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Confirm Pickup</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => { setOtpFor(j); setOtp(''); }} style={{ marginTop: 9, backgroundColor: C.primary, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <MaterialCommunityIcons name="package-down" size={17} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Deliver (OTP)</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* OTP modal */}
      <Modal visible={!!otpFor} transparent animationType="fade" onRequestClose={() => setOtpFor(null)}>
        <Pressable onPress={() => setOtpFor(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 28 }}>
          <Pressable style={{ backgroundColor: '#fff', borderRadius: 24, padding: 22 }}>
            <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 }}>
              <MaterialCommunityIcons name="shield-key-outline" size={28} color={C.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.text, textAlign: 'center' }}>Delivery OTP</Text>
            <Text style={{ fontSize: 13, color: C.textMid, textAlign: 'center', marginTop: 6 }}>Ask the customer for the 4-digit code to confirm delivery.</Text>
            <TextInput value={otp} onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="• • • •" placeholderTextColor="#C0CCC4"
              style={{ marginTop: 18, backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingVertical: 14, fontSize: 24, fontWeight: '900', letterSpacing: 12, textAlign: 'center', color: C.text }} />
            {otpFor?.otp ? <Text style={{ fontSize: 11.5, color: C.amber, textAlign: 'center', marginTop: 8 }}>Demo code: {otpFor.otp}</Text> : null}
            <TouchableOpacity onPress={confirmDeliver} disabled={submitting} style={{ marginTop: 16, backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: submitting ? 0.8 : 1 }}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Confirm Delivery</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
