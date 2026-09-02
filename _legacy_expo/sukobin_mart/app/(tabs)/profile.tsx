import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';

export default function ProfileScreen() {
  const [merchantData, setMerchantData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMerchantData();
  }, []);

  const fetchMerchantData = async () => {
    try {
      // First, try to fetch fresh data from API
      const response = await api.get('/api/merchant/getme');
      console.log('API Response:', response);

      if (response.success) {
        setMerchantData(response.merchant);
        // Update cache with fresh data
        await AsyncStorage.setItem('merchantData', JSON.stringify(response.merchant));
      } else {
        // If API fails, fall back to cached data
        const cachedData = await AsyncStorage.getItem('merchantData');
        if (cachedData) {
          setMerchantData(JSON.parse(cachedData));
        }
      }
    } catch (error) {
      console.error('Error fetching merchant data:', error);
      // Fall back to cached data on error
      const cachedData = await AsyncStorage.getItem('merchantData');
      if (cachedData) {
        setMerchantData(JSON.parse(cachedData));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove(['merchantToken', 'merchantData', 'merchantExpoPushToken']);
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9F8F4] justify-center items-center">
        <ActivityIndicator size="large" color="#1A3D2B" />
        <Text className="mt-4 text-[#1A3D2B] font-medium">Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <Text className="text-2xl font-bold text-[#1A3D2B]">Profile</Text>
        </View>

        {/* Profile Card */}
        <View className="mx-6 mb-6 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-[#D8F3DC] items-center justify-center mb-3 border-2 border-[#1A3D2B]">
              <Text className="text-4xl font-bold text-[#1A3D2B]">
                {merchantData?.name?.charAt(0) || 'M'}
              </Text>
            </View>
            <Text className="text-2xl font-bold text-[#1A3D2B]">
              {merchantData?.name || 'Merchant'}
            </Text>
            <Text className="text-gray-500">
              {merchantData?.phone || '+91 XXXXX XXXXX'}
            </Text>
            <Text className="text-sm text-[#40916C] font-medium mt-1">
              {merchantData?.email || 'email@business.com'}
            </Text>
          </View>
        </View>

        {/* Business Info */}
        <View className="mx-6 mb-6 bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <Text className="text-lg font-bold text-[#1A3D2B] mb-4">Business Information</Text>
          <View className="space-y-3">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Business Name</Text>
              <Text className="font-semibold text-[#1A3D2B]">
                {merchantData?.businessName || 'Business Name'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">GST Number</Text>
              <Text className="font-semibold text-[#1A3D2B]">
                {merchantData?.gstNumber || 'Not Added'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">PAN Number</Text>
              <Text className="font-semibold text-[#1A3D2B]">
                {merchantData?.panNumber || 'Not Added'}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Aadhaar Number</Text>
              <Text className="font-semibold text-[#1A3D2B]">
                {merchantData?.aadhaarNumber || 'Not Added'}
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="mx-6 mb-6">
          <View className="flex-row gap-4">
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 items-center">
              <Text className="text-2xl font-bold text-[#1A3D2B]">
                {merchantData?.totalOrders || 0}
              </Text>
              <Text className="text-xs text-gray-500">Total Orders</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 items-center">
              <Text className="text-2xl font-bold text-[#1A3D2B]">
                ₹{merchantData?.walletBalance || 0}
              </Text>
              <Text className="text-xs text-gray-500">Wallet Balance</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 items-center">
              <Text className="text-2xl font-bold text-[#1A3D2B]">
                {merchantData?.shops?.length || 0}
              </Text>
              <Text className="text-xs text-gray-500">Shops</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View className="mx-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <TouchableOpacity onPress={() => router.push('/manage-shop')} className="flex-row items-center p-4 border-b border-gray-100">
            <Ionicons name="storefront-outline" size={20} color="#1A3D2B" />
            <Text className="ml-3 text-gray-700 flex-1">My Shop</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(tabs)/products')} className="flex-row items-center p-4 border-b border-gray-100">
            <Ionicons name="cube-outline" size={20} color="#1A3D2B" />
            <Text className="ml-3 text-gray-700 flex-1">My Products</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')} className="flex-row items-center p-4 border-b border-gray-100">
            <Ionicons name="bar-chart-outline" size={20} color="#1A3D2B" />
            <Text className="ml-3 text-gray-700 flex-1">Analytics</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View className="flex-row items-center p-4 border-b border-gray-100">
            <Ionicons name="shield-checkmark-outline" size={20} color="#1A3D2B" />
            <Text className="ml-3 text-gray-700 flex-1">KYC Verification</Text>
            <View className={`px-2.5 py-0.5 rounded-full ${merchantData?.kycVerified ? 'bg-green-100' : 'bg-yellow-100'}`}>
              <Text className={`text-xs font-bold ${merchantData?.kycVerified ? 'text-green-700' : 'text-yellow-700'}`}>
                {merchantData?.kycVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="flex-row items-center p-4"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text className="ml-3 text-red-500 flex-1 font-medium">Logout</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}