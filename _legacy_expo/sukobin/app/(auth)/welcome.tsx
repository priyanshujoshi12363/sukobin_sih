import { View, Text, TouchableOpacity, StatusBar, Image } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />

      {/* Background Decorative Elements */}
      <View className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#DDFBE6] opacity-30" />
      <View className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-[#DDFBE6] opacity-20" />

      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 justify-between pb-8">
          
          {/* Top Section: Logo & Brand */}
          <View className="items-center mt-8">
            {/* Logo */}
            <View className="w-28 h-28 rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">
              <Image 
                source={require('../../assets/icon.png')} 
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>

            {/* Tagline */}
            <View className="mt-4 items-center">
              <Text className="text-sm font-bold text-[#4A8B6E] tracking-widest uppercase">
                Your Smart Mobility Partner
              </Text>
            </View>
          </View>

          {/* Middle Section: Main Content */}
          <View className="items-center px-4">
            {/* Fixed: "Move Smarter with" smaller, "Sukobin" bigger */}
            <View className="items-center">
              <Text className="text-2xl font-medium text-[#1A3B32] text-center">
                Move Smarter with
              </Text>
              <Text className="text-5xl font-extrabold text-[#4A8B6E] text-center leading-[58px]">
                Sukobin
              </Text>
            </View>

            <Text className="mt-4 text-gray-500 text-center text-base leading-7 max-w-[320px]">
              The eco-friendly way to ride and share parcels across your city
            </Text>

            {/* Feature Highlights */}
            <View className="flex-row justify-between w-full mt-8 px-2">

              <View className="items-center">
                <View className="w-16 h-16 bg-[#DDFBE6] rounded-2xl items-center justify-center mb-2 border border-[#C5EAD3]">
                  <MaterialCommunityIcons name="package-variant-closed" size={32} color="#1A3B32" />
                </View>
                <Text className="text-xs font-bold text-[#1A3B32]">Send Parcels</Text>
              </View>

              <View className="items-center">
                <View className="w-16 h-16 bg-[#DDFBE6] rounded-2xl items-center justify-center mb-2 border border-[#C5EAD3]">
                  <Ionicons name="location" size={32} color="#1A3B32" />
                </View>
                <Text className="text-xs font-bold text-[#1A3B32]">Live Tracking</Text>
              </View>

              <View className="items-center">
                <View className="w-16 h-16 bg-[#DDFBE6] rounded-2xl items-center justify-center mb-2 border border-[#C5EAD3]">
                  <Ionicons name="leaf" size={32} color="#1A3B32" />
                </View>
                <Text className="text-xs font-bold text-[#1A3B32]">Eco-Friendly</Text>
              </View>
            </View>
          </View>

          {/* Bottom Section: Buttons & Footer */}
          <View className="w-full">
            {/* Main Buttons - Added more spacing */}
           <View className="w-full">
  {/* Create Account Button */}
  <TouchableOpacity 
    activeOpacity={0.85}
    onPress={() => router.push("/register")}
    className="w-full py-4 rounded-xl bg-[#1A3B32] items-center shadow-lg flex-row justify-center mb-5"
  >
    <Text className="text-white font-bold text-lg tracking-wide mr-2">
      Create Account
    </Text>
    <Ionicons name="arrow-forward-circle" size={22} color="white" />
  </TouchableOpacity>

  {/* Login Button */}
  <TouchableOpacity 
    activeOpacity={0.85}
    onPress={() => router.push("/login")}
    className="w-full py-4 rounded-xl bg-white items-center border border-gray-200 shadow-sm flex-row justify-center"
  >
    <Text className="text-[#1A3B32] font-bold text-lg tracking-wide mr-2">
      Login
    </Text>
    <Ionicons name="log-in" size={22} color="#1A3B32" />
  </TouchableOpacity>
</View>

            {/* Footer */}
            <View className="mt-6 items-center">
              <Text className="text-[10px] text-gray-400 font-bold tracking-[1px] uppercase text-center">
                By continuing, you agree to our
              </Text>
              <TouchableOpacity>
                <Text className="text-[#1A3B32] text-[10px] font-bold tracking-[1px] uppercase mt-1">
                  Terms of Service & Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}