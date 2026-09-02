import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker, Region } from 'react-native-maps';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormData {
  shopName: string;
  description: string;
  category: string;
  subCategory: string;
  phoneNumber: string;
  houseNumber: string;
  landmark: string;
  village: string;
  town: string;
  district: string;
  state: string;
  pincode: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateShopScreen() {
  const [formData, setFormData] = useState<FormData>({
    shopName: '',
    description: '',
    category: '',
    subCategory: '',
    phoneNumber: '',
    houseNumber: '',
    landmark: '',
    village: '',
    town: '',
    district: '',
    state: '',
    pincode: '',
  });

  // Separate pin coords (lat/lng only) from map region (includes deltas).
  // Pin position is only updated on marker drag OR map tap — not on pan.
  const [pinCoords, setPinCoords] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
  });
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [shopLogo, setShopLogo]       = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [showMap, setShowMap]         = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    getUserLocation();
  }, []);

  // ─── Location ──────────────────────────────────────────────────────────────
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow location access to set your shop location');
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      setPinCoords({ latitude, longitude });
      setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location. Please tap or drag the pin on the map.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // ─── Image picker ──────────────────────────────────────────────────────────
  const pickImage = async (setImage: (uri: string) => void, aspect: [number, number] = [1, 1]) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: ['images'],   // ✅ Fixed this line
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
const handleCreateShop = async () => {
  const shopName = formData.shopName?.trim() || '';
  const description = formData.description?.trim() || '';
  const category = formData.category?.trim() || '';
  const phoneNumber = formData.phoneNumber?.trim() || '';
  
  if (!shopName || !description || !category || !phoneNumber) {
    Alert.alert('Missing Fields', 'Please fill in all required fields (*)');
    return;
  }

  setLoading(true);
  try {
    const formPayload = new FormData(); // ← renamed to avoid conflict with FormData interface
    
    formPayload.append('shopName', shopName);
    formPayload.append('description', description);
    formPayload.append('category', category);
    formPayload.append('subCategory', formData.subCategory?.trim() || '');
    formPayload.append('phoneNumber', phoneNumber);
    
    // Build fullAddress string
    const { houseNumber, landmark, village, town, district, state, pincode } = formData;
    const fullAddress = [houseNumber, landmark, village, town, district, state, pincode]
      .filter(Boolean)
      .join(' ');

    const addressObj = {
      houseNumber: houseNumber || '',
      landmark: landmark || '',
      village: village || '',
      town: town || '',
      district: district || '',
      state: state || '',
      pincode: pincode || '',
      fullAddress,
    };
    
    formPayload.append('address', JSON.stringify(addressObj));
    formPayload.append('coordinates', JSON.stringify([
      pinCoords.longitude,
      pinCoords.latitude,
    ]));

    if (shopLogo) {
      formPayload.append('shopLogo', {
        uri: shopLogo,
        type: 'image/jpeg',
        name: 'shop-logo.jpg',
      } as any);
    }
    
    if (bannerImage) {
      formPayload.append('bannerImage', {
        uri: bannerImage,
        type: 'image/jpeg',
        name: 'banner-image.jpg',
      } as any);
    }
console.log('shopName:', shopName);
console.log('type:', typeof shopName);
console.log('formPayload entries:');
// log each field before sending
   const response = await api.post('/api/shop/create', formPayload,true);
    
    if (response.data?.success || response.success) {
      const shopData = response.data?.shop || response.shop;
      await AsyncStorage.setItem('shopData', JSON.stringify(shopData));
      Alert.alert('Success', 'Shop created successfully!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
      ]);
    } else {
      Alert.alert('Error', response.data?.message || response.message || 'Failed to create shop');
    }
  } catch (error: any) {
    console.error('Create Shop Error:', error);
    const errorMessage = error?.response?.data?.message || 
                        error?.data?.message || 
                        error?.message || 
                        'Failed to create shop. Please try again.';
    Alert.alert('Error', errorMessage);
  } finally {
    setLoading(false);
  }
};
  // ─── Field helper ─────────────────────────────────────────────────────────
  const update = (key: keyof FormData) => (text: string) =>
    setFormData((prev) => ({ ...prev, [key]: text }));

  // ─── Loading state ────────────────────────────────────────────────────────
  if (isLoadingLocation) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
        <Text className="mt-4 text-[#1A3D2B] font-medium">Getting your location...</Text>
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 390 }}>
          <View className="px-6 pt-4">

            {/* ── Header ── */}
            <View className="flex-row items-center mb-6">
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.75}
                className="mr-4 w-9 h-9 rounded-full bg-white items-center justify-center"
                style={styles.shadow}
              >
                <Ionicons name="arrow-back" size={20} color="#1A3D2B" />
              </TouchableOpacity>
              <Text className="text-2xl font-bold text-[#1A3D2B]">Create Shop</Text>
            </View>

            {/* ── Location & Photos card ── */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100 mb-5" style={styles.shadow}>
              <Text className="text-sm font-bold text-gray-600 mb-3">Location & Photos</Text>

              {/* MAP */}
              <View className="mb-4">
                {showMap ? (
                  <View style={styles.mapContainer}>
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      region={mapRegion}
                      onRegionChangeComplete={(r) => setMapRegion(r)}
                      showsUserLocation
                      showsMyLocationButton
                      // ── TAP TO PLACE PIN ──────────────────────────────────
                      // Fires whenever the user taps anywhere on the map.
                      // e.nativeEvent.coordinate has the exact lat/lng tapped.
                      // Only pinCoords is updated — mapRegion stays the same
                      // so the viewport doesn't jump around.
                      onPress={(e) => {
                        setPinCoords({
                          latitude:  e.nativeEvent.coordinate.latitude,
                          longitude: e.nativeEvent.coordinate.longitude,
                        });
                      }}
                    >
                      <Marker
                        coordinate={pinCoords}
                        draggable
                        pinColor="#1A3D2B"
                        onDragEnd={(e) => {
                          // Drag also updates pin position
                          setPinCoords({
                            latitude:  e.nativeEvent.coordinate.latitude,
                            longitude: e.nativeEvent.coordinate.longitude,
                          });
                        }}
                      />
                    </MapView>

                    <TouchableOpacity
                      onPress={() => setShowMap(false)}
                      activeOpacity={0.8}
                      className="absolute top-2 right-2 bg-white p-2 rounded-full"
                      style={styles.shadow}
                    >
                      <Ionicons name="close" size={18} color="#1A3D2B" />
                    </TouchableOpacity>

                    {/* Hint label */}
                    <View className="absolute top-2 left-2 bg-white rounded-xl px-3 py-1.5" style={styles.shadow}>
                      <Text className="text-[11px] font-semibold text-[#1A3D2B]">
                        Tap map or drag pin to place
                      </Text>
                    </View>

                    {/* Pin coordinate readout */}
                    <View className="absolute bottom-2 left-2 bg-white rounded-xl px-3 py-1.5" style={styles.shadow}>
                      <Text className="text-[11px] font-semibold text-[#1A3D2B]">
                        📍 {pinCoords.latitude.toFixed(5)}, {pinCoords.longitude.toFixed(5)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowMap(true)}
                    activeOpacity={0.75}
                    className="h-40 rounded-xl border border-gray-200 bg-gray-50 items-center justify-center"
                  >
                    <View className="w-12 h-12 rounded-full bg-[#D8F3DC] items-center justify-center mb-2">
                      <Ionicons name="location-outline" size={26} color="#1A3D2B" />
                    </View>
                    <Text className="text-sm font-semibold text-[#1A3D2B]">
                      Tap to select shop location
                    </Text>
                    <Text className="text-xs text-gray-400 mt-1">
                      {pinCoords.latitude.toFixed(4)}, {pinCoords.longitude.toFixed(4)}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Photos */}
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => pickImage(setShopLogo, [1, 1])}
                  activeOpacity={0.75}
                  className="flex-1 h-24 rounded-xl border border-gray-200 bg-gray-50 items-center justify-center overflow-hidden"
                >
                  {shopLogo ? (
                    <Image source={{ uri: shopLogo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View className="items-center">
                      <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                      <Text className="text-xs text-gray-500 mt-1">Shop Logo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => pickImage(setBannerImage, [16, 9])}
                  activeOpacity={0.75}
                  className="flex-1 h-24 rounded-xl border border-gray-200 bg-gray-50 items-center justify-center overflow-hidden"
                >
                  {bannerImage ? (
                    <Image source={{ uri: bannerImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View className="items-center">
                      <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                      <Text className="text-xs text-gray-500 mt-1">Banner</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Shop Details card ── */}
            <View className="bg-white rounded-2xl p-4 border border-gray-100" style={styles.shadow}>
              <Text className="text-sm font-bold text-gray-600 mb-4">Shop Details</Text>

              <Field label="Shop Name *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter shop name"
                  value={formData.shopName}
                  onChangeText={update('shopName')}
                  style={styles.input}
                />
              </Field>

              <Field label="Description *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter shop description"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={formData.description}
                  onChangeText={update('description')}
                  style={[styles.input, { height: 80 }]}
                />
              </Field>

              <Field label="Category *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="e.g. Electronics, Grocery, Fashion"
                  value={formData.category}
                  onChangeText={update('category')}
                  style={styles.input}
                />
              </Field>

              <Field label="Sub Category">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="e.g. Mobile Phones, Fruits"
                  value={formData.subCategory}
                  onChangeText={update('subCategory')}
                  style={styles.input}
                />
              </Field>

              <Field label="Phone Number *">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  value={formData.phoneNumber}
                  onChangeText={update('phoneNumber')}
                  style={styles.input}
                />
              </Field>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-2">
                Address
              </Text>

              {/* Two-column row for House No + Pincode */}
              <View className="flex-row mb-4" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">House No.</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="e.g. 42B"
                    value={formData.houseNumber}
                    onChangeText={update('houseNumber')}
                    style={styles.input}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">Pincode</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="e.g. 110001"
                    keyboardType="numeric"
                    maxLength={6}
                    value={formData.pincode}
                    onChangeText={update('pincode')}
                    style={styles.input}
                  />
                </View>
              </View>

              <Field label="Landmark">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Near school, temple, etc."
                  value={formData.landmark}
                  onChangeText={update('landmark')}
                  style={styles.input}
                />
              </Field>

              <Field label="Village">
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter village"
                  value={formData.village}
                  onChangeText={update('village')}
                  style={styles.input}
                />
              </Field>

              {/* Two-column row for Town + District */}
              <View className="flex-row mb-4" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">Town</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="Enter town"
                    value={formData.town}
                    onChangeText={update('town')}
                    style={styles.input}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[12px] font-bold text-gray-600 mb-1">District</Text>
                  <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                    placeholder="Enter district"
                    value={formData.district}
                    onChangeText={update('district')}
                    style={styles.input}
                  />
                </View>
              </View>

              <Field label="State" last>
                <TextInput
                  className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800"
                  placeholder="Enter state"
                  value={formData.state}
                  onChangeText={update('state')}
                  style={styles.input}
                />
              </Field>
            </View>

            {/* ── Submit ── */}
            <TouchableOpacity
              onPress={handleCreateShop}
              disabled={loading}
              activeOpacity={0.85}
              className="w-full py-4 rounded-2xl bg-[#1A3D2B] items-center mt-6"
              style={styles.shadow}
            >
              {loading ? (
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-white font-bold text-base">Creating Shop...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-base">Create Shop</Text>
              )}
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  children,
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={{ marginBottom: last ? 0 : 16 }}>
      <Text className="text-[12px] font-bold text-gray-600 mb-1">{label}</Text>
      {children}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
  }) as object,

  mapContainer: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
  },

  input: {
    paddingVertical: Platform.OS === 'android' ? 10 : undefined,
    fontSize: 14,
    color: '#1A3D2B',
  },
});