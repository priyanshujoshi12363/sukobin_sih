import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/service/api';
import { MerchantNotificationService } from '@/service/notificationService';
const HARDCODED_OTP = '123456';

export default function LoginOtpScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phone as string;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);
  const [isResendActive, setIsResendActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(prev => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timer === 0) setIsResendActive(true);
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);

    try {
      if (otpCode !== HARDCODED_OTP) {
        Alert.alert('Invalid OTP', 'Please enter the correct OTP');
        return;
      }

      // Call login API with proper headers
      const response = await api.post('/api/merchant/login', {
        phone: phoneNumber
      });

      console.log('Login response:', response);

      // ✅ Check if response exists and has success field
      if (response && response.success) {
        // Save token and merchant data
        await AsyncStorage.setItem('merchantToken', response.token);
        await AsyncStorage.setItem('merchantData', JSON.stringify(response.merchant));

        // register this device's push token now that we're logged in
        MerchantNotificationService.initialize();

        Alert.alert('Success', 'Login successful!');
        router.replace('/(tabs)/home');
      } else {
        // If response exists but success is false
        const errorMessage = response?.message || 'Login failed';
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (isResendActive) {
      setTimer(45);
      setIsResendActive(false);
      Alert.alert('OTP Resent', 'A new code has been sent to your number');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      <View className="flex-1 px-6 pt-12">
        <View className="items-center mb-10">
          <Text className="text-3xl font-extrabold text-[#1A3D2B] text-center mb-2">Verify your number</Text>
          <Text className="text-gray-500 text-center text-base leading-6">
            We sent a 6-digit code to +91 {'\n'}
            <Text className="font-semibold text-[#1A3D2B]">{phoneNumber}</Text>
          </Text>
        </View>

        <View className="flex-row justify-between px-2 mb-6">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              className="w-12 h-14 border border-gray-200 rounded-xl bg-white text-center text-xl font-bold text-[#1A3D2B]"
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              autoFocus={index === 0}
            />
          ))}
        </View>

        <View className="flex-row justify-between items-center px-2 mb-10">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="pencil-outline" size={16} color="#6B7280" />
            <Text className="ml-1 text-gray-500 font-medium">Edit number</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleResend} disabled={!isResendActive}>
            <Ionicons name={isResendActive ? "refresh-outline" : "time-outline"} size={16} color={isResendActive ? "#40916C" : "#6B7280"} />
            <Text className={`ml-1 font-medium ${isResendActive ? 'text-[#40916C]' : 'text-gray-500'}`}>
              {isResendActive ? 'Resend code' : `Resend in 00:${timer.toString().padStart(2, '0')}`}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={handleVerifyOtp}
          disabled={loading}
          className={`w-full py-4 rounded-2xl items-center shadow-md ${
            otp.join('').length === 6 && !loading ? 'bg-[#1A3D2B]' : 'bg-[#40916C] opacity-60'
          }`}
        >
          <Text className="text-white font-bold text-lg">{loading ? 'Verifying...' : 'Verify OTP'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}