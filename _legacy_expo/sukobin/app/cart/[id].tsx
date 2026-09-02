import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  type: string;
}

export default function CartScreen() {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: '1',
      name: 'Ride to Kasauli',
      price: 450,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1506095168810-7ecf16654fa0',
      type: 'Ride'
    },
    {
      id: '2',
      name: 'Package to Shimla',
      price: 120,
      quantity: 2,
      image: 'https://images.unsplash.com/photo-1580674285054-bed31e145f59',
      type: 'Parcel'
    },
    {
      id: '3',
      name: 'Local Groceries',
      price: 85,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e',
      type: 'Groceries'
    }
  ]);

  const updateQuantity = (id: string, change: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => setCartItems(prev => prev.filter(item => item.id !== id))
        }
      ]
    );
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.05; // 5% tax
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() + 20; // 20 delivery fee
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Add items to your cart before checking out.');
      return;
    }
    
    Alert.alert(
      'Confirm Order',
      `Total: ₹${calculateTotal().toFixed(2)}\n\nProceed to checkout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Checkout', 
          onPress: () => {
            // Navigate to checkout or order confirmation
            Alert.alert('Success', 'Your order has been placed! 🎉');
            setCartItems([]);
          }
        }
      ]
    );
  };

  const clearCart = () => {
    if (cartItems.length === 0) return;
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: () => setCartItems([])
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F9F8F4]">
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      
      {/* --- Header --- */}
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Ionicons name="arrow-back" size={24} color="#1A3B32" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-[#1A3B32]">Your Cart</Text>
        </View>
        <TouchableOpacity onPress={clearCart}>
          <Text className="text-red-500 text-sm font-semibold">Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* --- Cart Items --- */}
      <ScrollView 
        className="flex-1 px-6 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {cartItems.length === 0 ? (
          <View className="flex-1 justify-center items-center mt-20">
            <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
            <Text className="text-xl font-bold text-gray-400 mt-4">Your cart is empty</Text>
            <Text className="text-gray-400 text-center mt-2">
              Add items to get started with your rides and deliveries
            </Text>
            <TouchableOpacity 
              className="mt-6 bg-[#1A3B32] px-8 py-3 rounded-xl"
              onPress={() => router.replace('/home')}
            >
              <Text className="text-white font-bold">Browse Services</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((item) => (
            <View 
              key={item.id} 
              className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100 flex-row"
            >
              <Image 
                source={{ uri: item.image }} 
                className="w-20 h-20 rounded-xl"
                resizeMode="cover"
              />
              <View className="flex-1 ml-4 justify-between">
                <View>
                  <Text className="text-sm font-bold text-[#1A3B32]">{item.name}</Text>
                  <Text className="text-xs text-gray-400">{item.type}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-lg font-bold text-[#1A3B32]">₹{item.price}</Text>
                  <View className="flex-row items-center">
                    <TouchableOpacity 
                      className="w-8 h-8 bg-[#DDFBE6] rounded-full items-center justify-center"
                      onPress={() => updateQuantity(item.id, -1)}
                    >
                      <Ionicons name="remove" size={16} color="#1A3B32" />
                    </TouchableOpacity>
                    <Text className="mx-3 font-bold text-[#1A3B32]">{item.quantity}</Text>
                    <TouchableOpacity 
                      className="w-8 h-8 bg-[#DDFBE6] rounded-full items-center justify-center"
                      onPress={() => updateQuantity(item.id, 1)}
                    >
                      <Ionicons name="add" size={16} color="#1A3B32" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                className="self-start"
                onPress={() => removeItem(item.id)}
              >
                <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* --- Bottom Checkout Section --- */}
      {cartItems.length > 0 && (
        <View className="bg-white border-t border-gray-200 px-6 pt-4 pb-8 shadow-lg">
          {/* --- Price Breakdown --- */}
          <View className="space-y-2">
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Subtotal</Text>
              <Text className="font-semibold text-[#1A3B32]">₹{calculateSubtotal().toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Tax (5%)</Text>
              <Text className="font-semibold text-[#1A3B32]">₹{calculateTax().toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">Delivery Fee</Text>
              <Text className="font-semibold text-[#1A3B32]">₹20.00</Text>
            </View>
            <View className="h-[1px] bg-gray-200 my-2" />
            <View className="flex-row justify-between">
              <Text className="text-lg font-bold text-[#1A3B32]">Total</Text>
              <Text className="text-lg font-bold text-[#1A3B32]">₹{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          {/* --- Checkout Button --- */}
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={handleCheckout}
            className="w-full py-4 rounded-2xl bg-[#1A3B32] items-center shadow-lg mt-4 flex-row justify-center"
          >
            <Text className="text-white font-bold text-lg mr-2">Proceed to Checkout</Text>
            <Ionicons name="arrow-forward" size={22} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}