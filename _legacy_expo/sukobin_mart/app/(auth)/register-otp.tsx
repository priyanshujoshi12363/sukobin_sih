import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StatusBar, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/service/api';
import { MerchantNotificationService } from '@/service/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HARDCODED_OTP = '123456';

export default function RegisterOtpScreen() {
  const params = useLocalSearchParams();
  const phoneNumber = params.phone as string;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(45);
  const [isResendActive, setIsResendActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    aadhaarNumber: '',
    panNumber: '',
    gstNumber: ''
  });

  const [showForm, setShowForm] = useState(false);

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
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem('partialMerchantData', JSON.stringify({
        phone: phoneNumber,
        isPartial: true,
        timestamp: new Date().toISOString()
      }));

      setShowForm(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.businessName || !formData.aadhaarNumber || !formData.panNumber) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/merchant/register', {
        name: formData.name,
        phone: phoneNumber,
        email: formData.email,
        businessName: formData.businessName,
        aadhaarNumber: formData.aadhaarNumber,
        panNumber: formData.panNumber,
        gstNumber: formData.gstNumber || ''
      });

      if (response.success) {
        await AsyncStorage.setItem('merchantToken', response.token);
        await AsyncStorage.setItem('merchantData', JSON.stringify(response.merchant));
        await AsyncStorage.removeItem('partialMerchantData');

        // register this device's push token now that we're logged in
        MerchantNotificationService.initialize();

        Alert.alert('Success', 'Merchant registered successfully!');
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('Error', response.message || 'Registration failed');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to register');
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 150}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 400 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-6 pt-12">
              <View className="items-center mb-10">
                <Text className="text-3xl font-extrabold text-[#1A3D2B] text-center mb-2">Verify your number</Text>
                <Text className="text-gray-500 text-center text-base leading-6">
                  We sent a 6-digit code to +91 {'\n'}
                  <Text className="font-semibold text-[#1A3D2B]">{phoneNumber}</Text>
                </Text>
              </View>

              {/* OTP Section */}
              {!showForm && (
                <>
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
                </>
              )}

              {/* Registration Form */}
              {showForm && (
                <View className="w-full mt-4">
                  <Text className="text-2xl font-bold text-[#1A3D2B] text-center mb-6">
                    Complete Your Registration
                  </Text>

                  <View className="space-y-4">
                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">Full Name *</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChangeText={(text) => setFormData({...formData, name: text})}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">Email *</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter your email"
                          keyboardType="email-address"
                          value={formData.email}
                          onChangeText={(text) => setFormData({...formData, email: text})}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">Business Name *</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="business-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter your business name"
                          value={formData.businessName}
                          onChangeText={(text) => setFormData({...formData, businessName: text})}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">Aadhaar Number *</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="card-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter Aadhaar number"
                          keyboardType="numeric"
                          maxLength={12}
                          value={formData.aadhaarNumber}
                          onChangeText={(text) => setFormData({...formData, aadhaarNumber: text})}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">PAN Number *</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="document-text-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter PAN number"
                          value={formData.panNumber}
                          onChangeText={(text) => setFormData({...formData, panNumber: text})}
                        />
                      </View>
                    </View>

                    <View>
                      <Text className="text-[12px] font-bold text-gray-600 mb-1">GST Number (Optional)</Text>
                      <View className="flex-row items-center border border-gray-200 rounded-xl px-4 py-3 bg-white">
                        <Ionicons name="receipt-outline" size={20} color="#9CA3AF" />
                        <TextInput
                          className="flex-1 ml-3 text-base text-gray-800"
                          placeholder="Enter GST number"
                          value={formData.gstNumber}
                          onChangeText={(text) => setFormData({...formData, gstNumber: text})}
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      onPress={handleRegister}
                      disabled={loading}
                      className="w-full py-4 rounded-2xl bg-[#1A3D2B] items-center shadow-md mt-2"
                    >
                      <Text className="text-white font-bold text-lg">
                        {loading ? 'Registering...' : 'Complete Registration'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}