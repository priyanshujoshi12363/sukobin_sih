import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isChecked, setIsChecked] = useState(false);

  const handleContinue = () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (!isChecked) {
      Alert.alert('Error', 'Please accept the Terms of Service');
      return;
    }

    router.push({
      pathname: '/(auth)/register-otp',
      params: { phone: phoneNumber }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0FAF3]">
      <StatusBar barStyle="dark-content" backgroundColor="#F0FAF3" />
      <View className="flex-1 px-6 pt-6">
        <View className="items-center mb-8">
          <View className="w-14 h-14 rounded-xl bg-white shadow-sm overflow-hidden">
            <Image source={require('../../assets/images/logo.png')} className="w-full h-full" resizeMode="cover" />
          </View>
        </View>

        <View className="items-center mb-8">
          <Text className="text-3xl font-extrabold text-[#1A3D2B] text-center">
            Register as Merchant
          </Text>
          <Text className="mt-2 text-gray-500 text-center text-base leading-6">
            Enter your phone number to get started
          </Text>
        </View>

        <View className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 w-full">
          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
            Mobile Number
          </Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 mb-6 bg-white">
            <View className="flex-row items-center border-r border-gray-200 pr-3 mr-3">
              <Ionicons name="call-outline" size={18} color="#40916C" />
              <Text className="ml-1 font-semibold text-gray-700">+91</Text>
            </View>
            <TextInput 
              className="flex-1 text-base text-gray-800"
              placeholder="Enter mobile number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              autoFocus={true}
            />
          </View>

          <TouchableOpacity 
            onPress={handleContinue}
            className={`w-full py-4 rounded-2xl flex-row justify-center items-center ${
              phoneNumber.length >= 10 && isChecked ? 'bg-[#1A3D2B]' : 'bg-[#40916C] opacity-60'
            }`}
          >
            <Text className="text-white font-bold text-lg mr-2">Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-start mt-6 px-2">
          <TouchableOpacity onPress={() => setIsChecked(!isChecked)}>
            <View className={`w-5 h-5 border rounded-md items-center justify-center ${
              isChecked ? 'bg-[#1A3D2B] border-[#1A3D2B]' : 'border-gray-300'
            }`}>
              {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
            </View>
          </TouchableOpacity>
          <Text className="flex-1 text-[12px] text-gray-500 leading-5 ml-3">
            By continuing, you agree to Sukobin's Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}