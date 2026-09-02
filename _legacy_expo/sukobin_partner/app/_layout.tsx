import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import './global.css';
import { PartnerNotifications, PartnerNotificationListener } from '@/lib/notify';

export default function RootLayout() {
  useEffect(() => { PartnerNotifications.register(); }, []);
  return (
    <>
      <StatusBar style="dark" />
      <PartnerNotificationListener />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: '#F4FBF6' },
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="trip" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
