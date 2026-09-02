
import React from 'react';
import { Animated, TouchableOpacity, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/_components/cartContext';

const C = {
  green900: '#1A3D2B',
  green400: '#52B788',
  green100: '#D8F3DC',
  white:    '#FFFFFF',
  amber:    '#F4A261',
};

export default function FloatingCart() {
  const { totalItems, totalPrice, fabAnim } = useCart();

  if (totalItems === 0) return null;

  const translateY = fabAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [120, 0],
  });

  const scale = fabAnim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: [0.6, 1.05, 1],
  });

  const opacity = fabAnim.interpolate({
    inputRange:  [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 100,          // 100px above bottom
        right: 20,
        transform: [{ translateY }, { scale }],
        opacity,
        zIndex: 999,
      }}
    >
      <TouchableOpacity
        onPress={() => router.push('/cart')}
        activeOpacity={0.9}
        style={{
          backgroundColor: C.green900,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          shadowColor: C.green900,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 14,
          elevation: 12,
        }}
      >
        {/* Cart icon with badge */}
        <View>
          <Ionicons name="cart" size={22} color={C.white} />
          <View style={{
            position: 'absolute', top: -6, right: -8,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: C.amber,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: C.green900,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: C.green900 }}>
              {totalItems > 99 ? '99+' : totalItems}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)' }} />

        {/* Price */}
        <View>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
            {totalItems} item{totalItems > 1 ? 's' : ''}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '900', color: C.white }}>
            ₹{totalPrice.toLocaleString('en-IN')}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
}