import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StatusBar, ActivityIndicator,
  TextInput, Platform, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setPendingLocation } from '@/utils/pendingLocation';

let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch {
    WebView = null;
  }
}

const C = {
  green900: '#1A3D2B', green700: '#15661A', green500: '#0C831F', green400: '#0C831F',
  green200: '#B7E4C7', green100: '#D8F3DC', green50: '#F0FAF3',
  white: '#FFFFFF', bg: '#F9F8F4', text: '#1A3D2B', textMid: '#4A7560', textSoft: '#7DAA90', red: '#E63946',
};

const DEFAULT = { lat: 29.2183, lng: 79.5130 }; // Haldwani

const nominatim = (path: string) =>
  fetch(`https://nominatim.openstreetmap.org/${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SukobinApp/1.0' },
  }).then((r) => r.json());

// Leaflet + OpenStreetMap inside a WebView — no Google dependency.
const leafletHTML = (lat: number, lng: number) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;width:100%;margin:0;padding:0;background:#e8efe9}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,crossOrigin:true}).addTo(map);
  function send(){var c=map.getCenter();if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng}));}}
  map.on('moveend',send);
  function handle(e){try{var d=JSON.parse(e.data);if(d&&d.recenter){map.setView([d.lat,d.lng],16);}}catch(_){}}
  document.addEventListener('message',handle);
  window.addEventListener('message',handle);
  setTimeout(function(){map.invalidateSize();send();},400);
</script>
</body>
</html>`;

export default function PickLocationScreen() {
  const params = useLocalSearchParams();
  const target = String(params.target || 'delivery');
  const targetLabel = target === 'pickup' ? 'pickup' : target === 'drop' ? 'drop' : target === 'home' ? 'home' : 'delivery';
  const initLat = params.lat ? Number(params.lat) : DEFAULT.lat;
  const initLng = params.lng ? Number(params.lng) : DEFAULT.lng;

  const webRef = useRef<any>(null);
  const [center, setCenter] = useState({ lat: initLat, lng: initLng });
  const [address, setAddress] = useState('');
  const [addrLoading, setAddrLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const revTimer = useRef<any>(null);
  const searchTimer = useRef<any>(null);

  // HTML built once with the initial center; later moves use injectJavaScript (no reload)
  const html = useMemo(() => leafletHTML(initLat, initLng), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reverse = useCallback(async (lat: number, lng: number) => {
    setAddrLoading(true);
    try {
      const j = await nominatim(`reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      setAddress(j.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setAddrLoading(false);
    }
  }, []);

  useEffect(() => { reverse(initLat, initLng); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // map centre updates streamed from the WebView
  const onMessage = (e: any) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        setCenter({ lat: d.lat, lng: d.lng });
        clearTimeout(revTimer.current);
        setAddrLoading(true);
        revTimer.current = setTimeout(() => reverse(d.lat, d.lng), 500);
      }
    } catch {}
  };

  const recenter = (lat: number, lng: number) => {
    webRef.current?.injectJavaScript(`map.setView([${lat}, ${lng}], 16); true;`);
  };

  // forward search (address → list of places)
  const onSearchChange = (text: string) => {
    setSearch(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 3) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const j = await nominatim(`search?format=json&q=${encodeURIComponent(text.trim())}&limit=6&countrycodes=in&addressdetails=1`);
        setResults(Array.isArray(j) ? j : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const pickResult = (res: any) => {
    const lat = Number(res.lat), lng = Number(res.lon);
    setResults([]);
    setSearch(res.display_name?.split(',').slice(0, 2).join(',') || '');
    setAddress(res.display_name || '');
    setCenter({ lat, lng });
    recenter(lat, lng);
  };

  const confirm = () => {
    setPendingLocation({
      target,
      coordinates: [center.lng, center.lat],
      address: address || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
    });
    router.back();
  };

  // ── Fallback when the native webview module isn't in the build yet ──
  if (!WebView) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Ionicons name="map-outline" size={56} color={C.green200} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 16, textAlign: 'center' }}>Map needs a rebuild</Text>
        <Text style={{ fontSize: 14, color: C.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          The OSM map uses react-native-webview (native). Rebuild the dev client to enable it:{'\n'}
          eas build --profile development --platform android
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, paddingHorizontal: 26, paddingVertical: 12, backgroundColor: C.green400, borderRadius: 14 }}>
          <Text style={{ color: C.white, fontWeight: '800' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <WebView
        ref={webRef}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#e8efe9' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green50 }}>
            <ActivityIndicator size="large" color={C.green400} />
            <Text style={{ marginTop: 10, color: C.textSoft, fontSize: 13 }}>Loading map…</Text>
          </View>
        )}
      />

      {/* Fixed centre pin (tip at map centre) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -46, alignItems: 'center' }}>
        <Ionicons name="location-sharp" size={44} color={C.red} style={{ textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -4, marginTop: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.25)' }} />

      {/* Top: back + search */}
      <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()} style={btnCircle}>
              <Ionicons name="arrow-back" size={20} color={C.green900} />
            </TouchableOpacity>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 14, paddingHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 }}>
              <Ionicons name="search" size={17} color={C.green500} />
              <TextInput
                value={search}
                onChangeText={onSearchChange}
                placeholder={`Search ${targetLabel} address / area`}
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: 14, color: C.text }}
                returnKeyType="search"
              />
              {searching
                ? <ActivityIndicator size="small" color={C.green400} />
                : search.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearch(''); setResults([]); }}>
                    <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {/* Results dropdown */}
          {results.length > 0 && (
            <View style={{ backgroundColor: C.white, borderRadius: 14, marginTop: 8, marginLeft: 52, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6, maxHeight: 260 }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {results.map((res, i) => (
                  <TouchableOpacity key={i} onPress={() => pickResult(res)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i === results.length - 1 ? 0 : 1, borderBottomColor: '#F1EFE8' }}>
                    <Ionicons name="location-outline" size={16} color={C.green500} />
                    <Text style={{ flex: 1, fontSize: 13, color: C.text }} numberOfLines={2}>{res.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Hint */}
      <View style={{ position: 'absolute', bottom: 188, alignSelf: 'center', backgroundColor: 'rgba(26,61,43,0.85)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="move" size={13} color={C.white} />
        <Text style={{ color: C.white, fontSize: 12, fontWeight: '600' }}>Drag the map to place the pin</Text>
      </View>

      {/* Bottom confirm card */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.white, position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: C.textSoft, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            {targetLabel.charAt(0).toUpperCase() + targetLabel.slice(1)} location
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 40 }}>
            <Ionicons name="location" size={18} color={C.green500} style={{ marginTop: 1 }} />
            {addrLoading
              ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator size="small" color={C.green400} /><Text style={{ color: C.textSoft, fontSize: 13 }}>Locating…</Text></View>
              : <Text style={{ flex: 1, fontSize: 13.5, color: C.text, lineHeight: 19 }} numberOfLines={3}>{address}</Text>}
          </View>

          <TouchableOpacity onPress={confirm} disabled={addrLoading} activeOpacity={0.9}
            style={{ marginTop: 14, backgroundColor: addrLoading ? C.green200 : C.green400, borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color={C.white} />
            <Text style={{ color: C.white, fontWeight: '900', fontSize: 15 }}>Confirm location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const btnCircle: any = {
  width: 42, height: 42, borderRadius: 21, backgroundColor: C.white,
  alignItems: 'center', justifyContent: 'center',
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
};
