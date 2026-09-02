import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Hardcoded OTP for development
const HARDCODED_OTP = '123456';

export default function OtpRegisterScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phone as string || 'XXXXXXXX';
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);
  const [isResendActive, setIsResendActive] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setIsResendActive(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter all 6 digits');
      return;
    }

    setLoading(true);

    try {
      // Hardcoded OTP check for development
      if (otpCode !== HARDCODED_OTP) {
        Alert.alert('Invalid OTP', 'Please enter the correct OTP');
        return;
      }

      // Call registration API with phone number
      const response = await api.post('/api/user/registration', {
        phone: phoneNumber
      });

      console.log('Registration API Response:', response);

      if (response.success) {
        // Save token and user data
        await AsyncStorage.setItem('userToken', response.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isPartialRegistration', 'true');
        
        // Navigate to complete profile
        router.replace('/complete-profile');
      } else {
        Alert.alert('Error', response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('OTP Error:', error);
      Alert.alert('Error', error.message || 'Failed to verify OTP');
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
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-12">
          
          {/* --- Header --- */}
          <View className="items-center mb-10">
            <Text className="text-3xl font-extrabold text-[#1A3B32] text-center mb-2">
              Verify your number
            </Text>
            <Text className="text-gray-500 text-center text-base leading-6">
              We sent a 6-digit code to +91 {'\n'}
              <Text className="font-semibold text-[#1A3B32]">{phoneNumber}</Text>
            </Text>
          </View>

          {/* --- OTP Inputs --- */}
          <View className="flex-row justify-between px-2 mb-6">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                className="w-12 h-14 border border-gray-200 rounded-xl bg-white text-center text-xl font-bold text-[#1A3B32]"
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                autoFocus={index === 0}
              />
            ))}
          </View>

          {/* --- Edit & Resend Row --- */}
          <View className="flex-row justify-between items-center px-2 mb-10">
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={() => router.back()}
            >
              <Ionicons name="pencil-outline" size={16} color="#6B7280" />
              <Text className="ml-1 text-gray-500 font-medium">Edit number</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center"
              onPress={handleResend}
              disabled={!isResendActive}
            >
              <Ionicons 
                name={isResendActive ? "refresh-outline" : "time-outline"} 
                size={16} 
                color={isResendActive ? "#4A8B6E" : "#6B7280"} 
              />
              <Text className={`ml-1 font-medium ${isResendActive ? 'text-[#4A8B6E]' : 'text-gray-500'}`}>
                {isResendActive ? 'Resend code' : `Resend in 00:${timer.toString().padStart(2, '0')}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* --- Verify Button --- */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleVerifyOtp}
            disabled={loading}
            className={`w-full py-4 rounded-2xl items-center shadow-md ${
              otp.join('').length === 6 && !loading ? 'bg-[#1A3B32]' : 'bg-[#4A8B6E] opacity-60'
            }`}
          >
            <Text className="text-white font-bold text-lg">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Text>
          </TouchableOpacity>

          {/* --- Resend Button (Alternative) --- */}
          {isResendActive && (
            <TouchableOpacity 
              activeOpacity={0.7}
              onPress={handleResend}
              className="w-full py-3 rounded-2xl bg-[#DDFBE6] items-center mt-3"
            >
              <Text className="text-[#4A8B6E] font-semibold">Resend via SMS</Text>
            </TouchableOpacity>
          )}

          {/* --- Footer --- */}
          <View className="mt-auto mb-4 items-center">
            <Text className="text-gray-500 text-sm">
              Having trouble?{' '}
              <Text className="text-[#1A3B32] font-bold">Contact Support</Text>
            </Text>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}