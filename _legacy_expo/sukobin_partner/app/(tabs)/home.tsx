import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Animated,
  Modal, Pressable, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { C, getVehicle, Job } from '@/lib/data';
import { tripStore } from '@/lib/tripStore';
import { api } from '@/lib/api';
import { LocationTracker } from '@/lib/location';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const TYPE_ICON: Record<string, string> = {
  Order: 'storefront', Documents: 'file-document-outline', Electronics: 'chip', Food: 'food',
  Clothes: 'tshirt-crew', Medicines: 'medical-bag', Other: 'cube-outline',
};

type Place = { label: string; coordinates: [number, number] };

// ── Address search (autocomplete) — type a specific place, pick a suggestion ──
const PlaceSearchModal = ({ visible, title, onClose, onPick }: { visible: boolean; title: string; onClose: () => void; onPick: (p: Place) => void }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!visible) { setQ(''); setResults([]); setLoading(false); } }, [visible]);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setResults([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/partner/places?q=${encodeURIComponent(s)}`);
        if (!cancelled) setResults(res?.places || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: C.bg2 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={onClose} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.green200 }}>
              <Ionicons name="arrow-back" size={20} color={C.green900} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.green900 }}>{title}</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.green200, paddingHorizontal: 12 }}>
              <Ionicons name="search" size={18} color={C.primary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search city / town in Uttarakhand"
                placeholderTextColor="#9CA3AF"
                autoFocus
                style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 15, color: C.text }}
              />
              {q.length > 0 && (
                <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={C.textSoft} /></TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
          {loading && <ActivityIndicator color={C.primary} style={{ marginTop: 18 }} />}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <Text style={{ textAlign: 'center', color: C.textSoft, marginTop: 24, fontSize: 13.5 }}>No matching town — check the spelling.</Text>
          )}
          {!loading && q.trim().length < 2 && (
            <Text style={{ textAlign: 'center', color: C.textSoft, marginTop: 24, fontSize: 13.5, paddingHorizontal: 30 }}>Type a city or town in Uttarakhand and pick it from the list.</Text>
          )}
          {results.map((p, i) => (
            <TouchableOpacity key={`${p.label}-${i}`} onPress={() => { onPick(p); onClose(); }} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                <Ionicons name="location-outline" size={17} color={C.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '600', color: C.text, lineHeight: 20 }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const JobCard = ({ j, index, selected, disabled, onToggle }: { j: Job; index: number; selected: boolean; disabled: boolean; onToggle: () => void }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true }).start(); }, []);
  const isOrder = j.kind === 'order';
  return (
    <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onToggle} disabled={disabled && !selected}
        style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: selected ? C.primary : C.border, opacity: disabled && !selected ? 0.5 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.green50, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name={(TYPE_ICON[j.type] || 'cube-outline') as any} size={19} color={C.primary} />
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {/* Order / Parcel badge */}
                <View style={{ backgroundColor: isOrder ? '#EAF3FF' : C.green100, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', color: isOrder ? '#2563EB' : C.primaryDark, letterSpacing: 0.3 }}>{isOrder ? 'ORDER' : 'PARCEL'}</Text>
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.text }}>{j.type}{j.weightKg ? ` · ${j.weightKg} kg` : ''}</Text>
              </View>
              <Text style={{ fontSize: 11, color: C.textSoft, marginTop: 1 }}>{j.refId}</Text>
            </View>
          </View>
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: selected ? C.primary : '#CDD8D1', backgroundColor: selected ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
          </View>
        </View>

        {/* pickup → drop */}
        <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="ellipse" size={9} color={C.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, flex: 1 }} numberOfLines={1}>{j.pickup.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="location" size={11} color={C.red} style={{ marginLeft: -1 }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.text, flex: 1 }} numberOfLines={1}>{j.drop.label}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialCommunityIcons name="map-marker-distance" size={13} color={C.textSoft} />
              <Text style={{ fontSize: 11.5, color: C.textMid, fontWeight: '600' }}>{(j.offRouteKm ?? 0)} km off</Text>
            </View>
            {j.etaMin ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="time-outline" size={13} color={C.textSoft} />
                <Text style={{ fontSize: 11.5, color: C.textMid, fontWeight: '600' }}>~{j.etaMin} min</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontSize: 16, fontWeight: '900', color: C.primary }}>+{inr(j.fee)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function Home() {
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const [picker, setPicker] = useState<null | 'from' | 'to'>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  // server-backed active trip — survives crashes; lets the driver resume
  useFocusEffect(useCallback(() => {
    api.get('/api/partner/trip/active')
      .then((r) => setActiveCount(r?.success ? (r.jobs?.length || 0) : 0))
      .catch(() => {});
  }, []));

  const onAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('partnerData').then((r) => {
      if (!r) return;
      const d = JSON.parse(r);
      setDriver(d);
      setOnline(!!d.isOnline);
    });
  }, []);
  useEffect(() => { Animated.spring(onAnim, { toValue: online ? 1 : 0, useNativeDriver: false }).start(); }, [online]);

  // stream live location while online; stop when offline
  useEffect(() => {
    if (online) LocationTracker.start();
    else LocationTracker.stop();
  }, [online]);

  const vehicle = getVehicle(driver?.vehicleType);
  const capacity = driver?.capacity || vehicle.capacity;

  // ── fetch matching jobs whenever online + a full route is set ──
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!online || !from || !to) { setJobs([]); return; }
      setLoadingJobs(true);
      try {
        const res = await api.post('/api/partner/route/match', {
          origin: { coordinates: from.coordinates, label: from.label },
          destination: { coordinates: to.coordinates, label: to.label },
        });
        if (!cancelled) setJobs(res?.success ? (res.jobs || []) : []);
      } catch {
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [online, from, to]);

  const selectedJobs = jobs.filter((j) => selected.has(j.refId));
  const total = selectedJobs.reduce((s, j) => s + j.fee, 0);

  // ── Toggle online/offline (optimistic + rollback) ──
  const toggleOnline = async () => {
    if (toggling) return;
    const next = !online;
    setToggling(true);
    setOnline(next);
    if (!next) setSelected(new Set());
    try {
      const res = await api.patch('/api/partner/online', { isOnline: next });
      if (res?.success) {
        const raw = await AsyncStorage.getItem('partnerData');
        if (raw) { const d = JSON.parse(raw); d.isOnline = next; await AsyncStorage.setItem('partnerData', JSON.stringify(d)); }
      } else { setOnline(!next); Alert.alert('Could not update', res?.message || 'Please try again.'); }
    } catch { setOnline(!next); Alert.alert('Network error', 'Check your connection and try again.'); }
    finally { setToggling(false); }
  };

  const toggle = (refId: string) => {
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(refId)) nextSet.delete(refId);
      else if (nextSet.size < capacity) nextSet.add(refId);
      else Alert.alert('Vehicle full', `Your ${vehicle.label} can carry up to ${capacity} job${capacity > 1 ? 's' : ''}.`);
      return nextSet;
    });
  };

  const startTrip = async () => {
    if (selectedJobs.length === 0 || claiming) return;
    setClaiming(true);
    try {
      const res = await api.post('/api/partner/trip/claim', {
        jobs: selectedJobs.map((j) => ({ kind: j.kind, id: j.refId })),
      });
      if (res?.success && res.claimed?.length) {
        tripStore.set({ from: from?.label || '', to: to?.label || '', vehicleKey: vehicle.key, jobs: res.claimed, startedAt: Date.now() });
        if (res.skipped) Alert.alert('Heads up', `${res.skipped} job(s) were just taken by another partner — starting with the rest.`);
        setSelected(new Set());
        router.push('/trip');
      } else {
        Alert.alert('Could not start trip', res?.message || 'These jobs may have just been taken. Refresh and try again.');
      }
    } catch {
      Alert.alert('Network error', 'Could not start the trip. Try again.');
    } finally {
      setClaiming(false);
    }
  };

  const knobLeft = onAnim.interpolate({ inputRange: [0, 1], outputRange: [3, 27] });
  const trackBg = onAnim.interpolate({ inputRange: [0, 1], outputRange: ['#C9D3CC', C.primary] as any });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg2} />
      {/* Header */}
      <View style={{ backgroundColor: C.bg2, paddingBottom: 24, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
        <SafeAreaView edges={['top']}>
          <View style={{ paddingHorizontal: 20, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.textSoft, fontSize: 13, fontWeight: '700' }}>Hello, driver</Text>
              <Text style={{ color: C.green900, fontSize: 20, fontWeight: '900' }}>{driver?.name || 'Partner'}</Text>
            </View>
            <TouchableOpacity onPress={toggleOnline} disabled={toggling} activeOpacity={0.9} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: C.green200, opacity: toggling ? 0.7 : 1 }}>
              <Text style={{ color: online ? C.primary : C.textSoft, fontSize: 12.5, fontWeight: '800' }}>{online ? 'Online' : 'Offline'}</Text>
              {toggling ? (
                <ActivityIndicator size="small" color={C.primary} style={{ width: 44 }} />
              ) : (
                <Animated.View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: trackBg, justifyContent: 'center' }}>
                  <Animated.View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', position: 'absolute', left: knobLeft }} />
                </Animated.View>
              )}
            </TouchableOpacity>
          </View>

          {/* vehicle chip */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.green100 }}>
              <MaterialCommunityIcons name={vehicle.icon as any} size={15} color={C.primary} />
              <Text style={{ color: C.green900, fontSize: 12.5, fontWeight: '700' }}>{vehicle.label}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: C.green100 }}>
              <MaterialCommunityIcons name="card-text-outline" size={14} color={C.green500} />
              <Text style={{ color: C.green900, fontSize: 12.5, fontWeight: '700' }}>{driver?.vehicleNumber || 'UK 04 —'}</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 200 }}>
        {/* Resume active trip (server-backed — survives crashes) */}
        {activeCount > 0 && (
          <TouchableOpacity onPress={() => router.push('/trip')} activeOpacity={0.9}
            style={{ backgroundColor: C.green900, borderRadius: 16, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="truck-fast" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14.5, fontWeight: '900' }}>You have an active trip</Text>
              <Text style={{ color: C.green200, fontSize: 12.5, fontWeight: '600' }}>{activeCount} deliver{activeCount > 1 ? 'ies' : 'y'} in progress — tap to resume</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={26} color="#fff" />
          </TouchableOpacity>
        )}

        {!online ? (
          /* ── Offline gate ── */
          <View style={{ alignItems: 'center', paddingTop: 46, marginTop: 4 }}>
            <View style={{ width: 96, height: 96, borderRadius: 30, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              <MaterialCommunityIcons name="power-sleep" size={46} color={C.green500} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: '900', color: C.green900 }}>You’re offline</Text>
            <Text style={{ fontSize: 13.5, color: C.textMid, marginTop: 8, textAlign: 'center', paddingHorizontal: 34, lineHeight: 20 }}>
              Go online to pick your route and see deliveries heading your way.
            </Text>
            <TouchableOpacity onPress={toggleOnline} disabled={toggling} activeOpacity={0.9}
              style={{ marginTop: 24, backgroundColor: C.primary, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 200, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 }}>
              {toggling ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="power" size={19} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>Go Online</Text></>}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Route card */}
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.border, marginTop: -14 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: C.textSoft, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Your route today</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ alignItems: 'center', width: 22 }}>
                  <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.primary }} />
                  <View style={{ width: 2, height: 26, backgroundColor: C.green100, marginVertical: 3 }} />
                  <Ionicons name="location" size={15} color={C.red} />
                </View>
                <View style={{ flex: 1, marginLeft: 10, gap: 8 }}>
                  <TouchableOpacity onPress={() => setPicker('from')} style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: from ? C.text : C.textSoft }}>{from?.label || 'Search pickup point'}</Text>
                    <Ionicons name="search" size={15} color={C.textSoft} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setPicker('to')} style={{ backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: to ? C.text : C.textSoft }}>{to?.label || 'Search destination'}</Text>
                    <Ionicons name="search" size={15} color={C.textSoft} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Matched jobs */}
            {from && to ? (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '900', color: C.text, flex: 1, marginRight: 8 }}>On your way</Text>
                  <View style={{ backgroundColor: C.green100, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: C.primaryDark }}>{selected.size}/{capacity} loaded</Text>
                  </View>
                </View>
                {/* capacity bar */}
                <View style={{ height: 7, backgroundColor: C.green100, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
                  <View style={{ width: `${Math.min(100, (selected.size / capacity) * 100)}%`, height: 7, backgroundColor: C.primary, borderRadius: 4 }} />
                </View>

                {loadingJobs ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={{ fontSize: 13, color: C.textMid, marginTop: 12, fontWeight: '600' }}>Finding deliveries on your route…</Text>
                  </View>
                ) : jobs.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <MaterialCommunityIcons name="package-variant" size={44} color={C.green200} />
                    <Text style={{ fontSize: 14, color: C.textMid, marginTop: 10, fontWeight: '600' }}>No deliveries for this route yet</Text>
                    <Text style={{ fontSize: 12.5, color: C.textSoft, marginTop: 2 }}>Try another destination</Text>
                  </View>
                ) : jobs.map((j, i) => (
                  <JobCard key={`${j.kind}-${j.refId}`} j={j} index={i} selected={selected.has(j.refId)} disabled={selected.size >= capacity} onToggle={() => toggle(j.refId)} />
                ))}
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 50, marginTop: 10 }}>
                <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: C.green100, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <MaterialCommunityIcons name="map-marker-path" size={40} color={C.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: C.text }}>Set your route to see deliveries</Text>
                <Text style={{ fontSize: 13, color: C.textMid, marginTop: 6, textAlign: 'center', paddingHorizontal: 30 }}>
                  Pick where you’re going — we’ll show orders & parcels headed the same way.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Start trip bar */}
      {online && selectedJobs.length > 0 && (
        <View style={{ position: 'absolute', bottom: 92, left: 16, right: 16 }}>
          <TouchableOpacity onPress={startTrip} disabled={claiming} activeOpacity={0.92}
            style={{ backgroundColor: C.primary, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: claiming ? 0.8 : 1, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11.5, fontWeight: '700' }}>{selectedJobs.length} job{selectedJobs.length > 1 ? 's' : ''} · {inr(total)}</Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Start Trip</Text>
            </View>
            {claiming ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="steering" size={20} color="#fff" />
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <PlaceSearchModal visible={picker === 'from'} title="Pickup point" onClose={() => setPicker(null)} onPick={(p) => { setFrom(p); setSelected(new Set()); }} />
      <PlaceSearchModal visible={picker === 'to'} title="Destination" onClose={() => setPicker(null)} onPick={(p) => { setTo(p); setSelected(new Set()); }} />
    </View>
  );
}
