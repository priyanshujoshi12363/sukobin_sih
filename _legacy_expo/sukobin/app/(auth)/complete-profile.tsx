import React, { useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationService } from '@/utils/notificationService';
import { takePendingLocation } from '@/utils/pendingLocation';

export default function CompleteRegistration() {
  const [formData, setFormData] = useState({
    name: '',
    houseNumber: '',
    landmark: '',
    village: '',
    town: '',
    district: '',
    state: '',
    pincode: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coords, setCoords] = useState<number[] | null>(null); // [lng, lat]
  const [locAddress, setLocAddress] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Pick up the home location chosen on the map screen
  useFocusEffect(useCallback(() => {
    const picked = takePendingLocation();
    if (picked?.target === 'home') { setCoords(picked.coordinates); setLocAddress(picked.address); }
  }, []));

  const openMap = () => {
    router.push({ pathname: '/pick-location', params: { target: 'home', lat: coords?.[1] ?? '', lng: coords?.[0] ?? '' } });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.houseNumber || !formData.village || !formData.town || !formData.district || !formData.state || !formData.pincode) {
      Alert.alert('Incomplete Profile', 'Please fill in all required fields');
      return;
    }
    if (!coords) {
      Alert.alert('Pin your location', 'Set your home location on the map — we use it to match deliveries near you.');
      return;
    }

    setIsSubmitting(true);

    try {
      const fullAddress = `${formData.houseNumber}, ${formData.landmark ? formData.landmark + ', ' : ''}${formData.village}, ${formData.town}, ${formData.state} - ${formData.pincode}`;

      const requestBody = {
        name: formData.name,
        houseNumber: formData.houseNumber,
        landmark: formData.landmark,
        village: formData.village,
        town: formData.town,
        district: formData.district,
        state: formData.state,
        pincode: formData.pincode,
        fullAddress: fullAddress,
        location: coords
      };

      const response = await api.post('/api/user/complete-registration', requestBody);

      if (response.success) {
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.removeItem('isPartialRegistration');
        
        // ✅ Initialize push notifications for the user
        await NotificationService.initialize();
        
        Alert.alert('Success', 'Profile completed successfully!');
        router.replace('/home');
      } else {
        Alert.alert('Error', response.message || 'Failed to complete registration');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldFocus = (fieldIndex: number) => {
    if (fieldIndex >= 6) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 250 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-6">
            
            {/* --- Header --- */}
            <View className="items-center mb-8">
              <View className="w-16 h-16 bg-[#DDFBE6] rounded-2xl items-center justify-center mb-4">
                <Ionicons name="person-add-outline" size={32} color="#1A3B32" />
              </View>
              <Text className="text-3xl font-extrabold text-[#1A3B32] text-center mb-2">
                Complete Your Profile
              </Text>
              <Text className="text-gray-500 text-center text-base leading-6">
                Please provide your address details to{' '}
                <Text className="text-[#4A8B6E] font-medium">get started</Text>
              </Text>
            </View>

            {/* --- Form Card --- */}
            <View className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 w-full">
              
              {/* Progress Steps */}
              <View className="flex-row items-center justify-center mb-6">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-[#1A3B32] items-center justify-center">
                    <Text className="text-white text-xs font-bold">1</Text>
                  </View>
                  <View className="w-8 h-[2px] bg-[#1A3B32]" />
                  <View className="w-8 h-8 rounded-full bg-[#1A3B32] items-center justify-center">
                    <Text className="text-white text-xs font-bold">2</Text>
                  </View>
                  <View className="w-8 h-[2px] bg-gray-200" />
                  <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center">
                    <Text className="text-gray-400 text-xs font-bold">3</Text>
                  </View>
                </View>
              </View>

              {/* Home location — pin on OSM map */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Home Location <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={openMap}
                  activeOpacity={0.8}
                  className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white"
                >
                  <View className="w-9 h-9 rounded-lg bg-[#DDFBE6] items-center justify-center">
                    <Ionicons name="location" size={18} color="#1A3B32" />
                  </View>
                  <View className="flex-1 ml-3">
                    {coords ? (
                      <Text className="text-base text-gray-800" numberOfLines={1}>{locAddress || 'Pinned on map'}</Text>
                    ) : (
                      <Text className="text-base text-[#0C831F] font-semibold">Set your location on map</Text>
                    )}
                  </View>
                  <Ionicons name={coords ? 'create-outline' : 'chevron-forward'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Name */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Full Name <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter your full name"
                    placeholderTextColor="#9CA3AF"
                    value={formData.name}
                    onChangeText={(text) => handleChange('name', text)}
                    onFocus={() => handleFieldFocus(0)}
                  />
                </View>
              </View>

              {/* House Number */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  House / Flat Number <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="home-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter house number"
                    placeholderTextColor="#9CA3AF"
                    value={formData.houseNumber}
                    onChangeText={(text) => handleChange('houseNumber', text)}
                    onFocus={() => handleFieldFocus(1)}
                  />
                </View>
              </View>

              {/* Landmark */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Landmark
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="location-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Near Temple, etc."
                    placeholderTextColor="#9CA3AF"
                    value={formData.landmark}
                    onChangeText={(text) => handleChange('landmark', text)}
                    onFocus={() => handleFieldFocus(2)}
                  />
                </View>
              </View>

              {/* Village */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Village / Locality <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="map-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter village or locality"
                    placeholderTextColor="#9CA3AF"
                    value={formData.village}
                    onChangeText={(text) => handleChange('village', text)}
                    onFocus={() => handleFieldFocus(3)}
                  />
                </View>
              </View>

              {/* Town */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Town / City <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="business-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter town or city"
                    placeholderTextColor="#9CA3AF"
                    value={formData.town}
                    onChangeText={(text) => handleChange('town', text)}
                    onFocus={() => handleFieldFocus(4)}
                  />
                </View>
              </View>

              {/* District */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  District <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="flag-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter district"
                    placeholderTextColor="#9CA3AF"
                    value={formData.district}
                    onChangeText={(text) => handleChange('district', text)}
                    onFocus={() => handleFieldFocus(5)}
                  />
                </View>
              </View>

              {/* State */}
              <View className="mb-5">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  State <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="map" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter state"
                    placeholderTextColor="#9CA3AF"
                    value={formData.state}
                    onChangeText={(text) => handleChange('state', text)}
                    onFocus={() => handleFieldFocus(6)}
                  />
                </View>
              </View>

              {/* Pincode */}
              <View className="mb-6">
                <Text className="text-[12px] font-bold text-gray-600 mb-1 ml-1">
                  Pincode <Text className="text-red-500">*</Text>
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                  <TextInput 
                    className="flex-1 ml-3 text-base text-gray-800"
                    placeholder="Enter 6-digit pincode"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    maxLength={6}
                    value={formData.pincode}
                    onChangeText={(text) => handleChange('pincode', text)}
                    onFocus={() => handleFieldFocus(7)}
                  />
                </View>
              </View>

              {/* --- Submit Button --- */}
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-2xl items-center shadow-md flex-row justify-center ${
                  isSubmitting ? 'bg-[#4A8B6E]' : 'bg-[#1A3B32]'
                }`}
              >
                <Text className="text-white font-bold text-lg mr-2">
                  {isSubmitting ? 'Saving...' : 'Save & Continue'}
                </Text>
                {!isSubmitting && <Ionicons name="arrow-forward" size={22} color="white" />}
              </TouchableOpacity>

              {/* --- Skip Option --- */}
              <TouchableOpacity 
                className="mt-4 items-center"
                onPress={() => router.replace('/home')}
              >
                <Text className="text-gray-400 text-sm">
                  Skip for now
                </Text>
              </TouchableOpacity>

            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}