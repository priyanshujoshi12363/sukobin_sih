import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import "./global.css";
import { MerchantNotificationService } from '@/service/notificationService';
import { NotificationListener } from '@/service/NotificationListener';

export default function RootLayout() {
  useEffect(() => {
    // Register this merchant's Expo push token with the backend (if logged in)
    MerchantNotificationService.initialize();
  }, []);

  return (
    <>
      <StatusBar style="dark" backgroundColor="#F9F8F4" />
      <NotificationListener />
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
        <Stack.Screen name="create-shop" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="order-detail" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}