import { View, Text, TouchableOpacity, StatusBar, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#F0FAF3]">
      <StatusBar barStyle="dark-content" backgroundColor="#F0FAF3" />

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 px-6 justify-center items-center pt-8">
          {/* Logo with enhanced styling */}
          <View className="w-32 h-32 mb-6 rounded-3xl bg-white shadow-xl overflow-hidden items-center justify-center border border-[#D8F3DC]">
            <Image
              source={require('../../assets/images/logo.png')}
              style={{ width: '100%', height: '100%', transform: [{ scale: 1.35 }] }}
              resizeMode="contain"
            />
          </View>

          <Text className="text-4xl font-extrabold text-[#1A3D2B] text-center">
            Sukobin Merchant
          </Text>
          <Text className="text-[#40916C] text-center text-sm font-semibold mt-1 uppercase tracking-wider">
            Grow Your Business
          </Text>

          <Text className="text-gray-600 text-center text-base mt-4 leading-6 px-4">
            List your products, receive orders, and hand them to Sukobin partners for delivery across the hills. Grow your business today.
          </Text>

          {/* Feature Highlights */}
          <View className="w-full mt-8 space-y-3 px-2">
            <View className="flex-row items-center bg-white/80 rounded-2xl p-3 shadow-sm border border-[#D8F3DC]">
              <View className="bg-[#D8F3DC] p-2 rounded-full">
                <Ionicons name="cube-outline" size={20} color="#1A3D2B" />
              </View>
              <Text className="ml-3 text-[#1A3D2B] font-medium flex-1">Easy product & order management</Text>
            </View>

            <View className="flex-row items-center bg-white/80 rounded-2xl p-3 shadow-sm border border-[#D8F3DC]">
              <View className="bg-[#D8F3DC] p-2 rounded-full">
                <Ionicons name="notifications-outline" size={20} color="#1A3D2B" />
              </View>
              <Text className="ml-3 text-[#1A3D2B] font-medium flex-1">Instant new-order notifications</Text>
            </View>

            <View className="flex-row items-center bg-white/80 rounded-2xl p-3 shadow-sm border border-[#D8F3DC]">
              <View className="bg-[#D8F3DC] p-2 rounded-full">
                <Ionicons name="trending-up-outline" size={20} color="#1A3D2B" />
              </View>
              <Text className="ml-3 text-[#1A3D2B] font-medium flex-1">Track your business growth</Text>
            </View>
          </View>

          {/* Main Buttons with proper gap */}
          <View className="w-full mt-10 space-y-4">
            <TouchableOpacity 
              onPress={() => router.push('/(auth)/register')}
              className="w-full py-4 rounded-2xl bg-[#1A3D2B] items-center shadow-lg flex-row justify-center"
            >
              <Text className="text-white font-bold text-lg mr-2">Register as Merchant</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>

            {/* ✅ Added margin-bottom to create gap */}
            <TouchableOpacity 
              onPress={() => router.push('/(auth)/login')}
              className="w-full py-4 rounded-2xl bg-white items-center border border-[#1A3D2B] shadow-sm flex-row justify-center mt-4"
            >
              <Text className="text-[#1A3D2B] font-bold text-lg mr-2">Login</Text>
              <Ionicons name="log-in-outline" size={20} color="#1A3D2B" />
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-6 items-center">
            <Text className="text-gray-400 text-xs">
              By continuing, you agree to Sukobin's Terms of Service
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}