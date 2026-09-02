import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import "./global.css";
import { NotificationService } from '@/utils/notificationService';
import { NotificationListener } from '@/_components/NotificationListener';
import { CartProvider } from '@/_components/cartContext';
import { useEffect } from 'react';

  export default function RootLayout() {
  useEffect(() => {
    // Initialize push notifications when app starts
    NotificationService.initialize();
  }, []);
  return (
    <CartProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F8F4" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: '#F9F8F4',
          },
        }}
      >

        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="shop/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="cart/index" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="cart/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="checkout" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="edit-address" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="order/success" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="pick-location" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
      </Stack>
    </CartProvider>
  );
}