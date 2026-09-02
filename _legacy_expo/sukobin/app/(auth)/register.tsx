import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RegisterScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [checkingPartial, setCheckingPartial] = useState(true);

  useEffect(() => {
    checkPartialRegistration();
  }, []);

  const checkPartialRegistration = async () => {
    try {
      const isPartial = await AsyncStorage.getItem('isPartialRegistration');
      const userData = await AsyncStorage.getItem('userData');
      
      if (isPartial === 'true' && userData) {
        // Partial registration exists, go directly to complete profile
        router.replace('/complete-profile');
      }
    } catch (error) {
      console.error('Error checking partial registration:', error);
    } finally {
      setCheckingPartial(false);
    }
  };

  const handleContinue = () => {
    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    if (!isChecked) {
      Alert.alert('Error', 'Please accept the Terms of Service');
      return;
    }

    // Navigate to OTP Register screen
    router.push({
      pathname: '/otp-register',
      params: { 
        phone: phoneNumber
      }
    });
  };

  if (checkingPartial) {
    return (
      <SafeAreaView className="flex-1 bg-[#F8FCF9] justify-center items-center">
        <Text className="text-[#1A3B32]">Checking registration status...</Text>
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView className="flex-1 bg-[#F8FCF9]">
        <StatusBar barStyle="dark-content" backgroundColor="#F8FCF9" />

        <View className="flex-1 px-6 pt-6">
          
          {/* --- Logo Section --- */}
          <View className="items-center mb-8">
            <View className="w-14 h-14 rounded-xl bg-white shadow-sm overflow-hidden">
              <Image 
                source={require('../../assets/icon.png')} 
                className="w-full h-full"
                resizeMode="cover" 
              />
            </View>
          </View>

          {/* --- Header Text --- */}
          <View className="items-center mb-8">
            <Text className="text-3xl font-extrabold text-[#1A3B32] text-center">
              Welcome to Sukobin
            </Text>
            <Text className="mt-2 text-gray-500 text-center text-base leading-6">
              India's smart ride & parcel sharing{' '}
              <Text className="text-[#4A8B6E] font-medium">platform</Text>
            </Text>
          </View>

          {/* --- Main Card --- */}
          <View className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 w-full">
            
            {/* Mobile Number Label */}
            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">
              Mobile Number
            </Text>

            {/* Phone Input Container */}
            <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 mb-6 bg-white">
              
              {/* Country Code */}
              <View className="flex-row items-center border-r border-gray-200 pr-3 mr-3">
                <Ionicons name="call-outline" size={18} color="#4A8B6E" />
                <Text className="ml-1 font-semibold text-gray-700">+91</Text>
              </View>

              {/* Input */}
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

            {/* Continue Button */}
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={handleContinue}
              className={`w-full py-4 rounded-2xl flex-row justify-center items-center ${
                phoneNumber.length >= 10 && isChecked ? 'bg-[#1A3B32]' : 'bg-[#4A8B6E] opacity-60'
              }`}
            >
              <Text className="text-white font-bold text-lg mr-2">Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>

          </View>

          {/* --- Footer (Checkbox + Terms) --- */}
          <View className="flex-row items-start mt-6 px-2">
            
            {/* Custom Checkbox */}
            <TouchableOpacity 
              className="mt-0.5 mr-3"
              onPress={() => setIsChecked(!isChecked)}
            >
              <View className={`w-5 h-5 border rounded-md items-center justify-center ${
                isChecked ? 'bg-[#1A3B32] border-[#1A3B32]' : 'border-gray-300'
              }`}>
                {isChecked && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
            </TouchableOpacity>

            {/* Terms Text */}
            <Text className="flex-1 text-[12px] text-gray-500 leading-5">
              By continuing, you agree to Sukobin's{' '}
              <Text className="text-[#1A3B32] font-semibold">Terms of Service</Text>
              {' '}and{' '}
              <Text className="text-[#1A3B32] font-semibold">Privacy Policy</Text>
            </Text>
          </View>

        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}