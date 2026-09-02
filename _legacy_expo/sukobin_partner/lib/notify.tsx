import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Android custom sound requires a channel configured with it (matches the
// backend push payload's channelId: 'default').
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('sukobin_alerts', {
    name: 'Sukobin Alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'notification.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2D6A4F',
  }).catch(() => {});
}

export const PartnerNotifications = {
  async getToken(): Promise<string | null> {
    if (!Device.isDevice) return null;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') final = (await Notifications.requestPermissionsAsync()).status;
    if (final !== 'granted') return null;
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      return token.data;
    } catch (e) {
      console.error('Partner push token error:', e);
      return null;
    }
  },

  async register(): Promise<void> {
    try {
      const auth = await AsyncStorage.getItem('partnerToken');
      if (!auth) return;
      const token = await this.getToken();
      if (!token) return;
      const stored = await AsyncStorage.getItem('partnerExpoToken');
      if (token === stored) return;
      const res = await api.post('/api/partner/notify', { expoPushToken: token });
      if (res?.success) await AsyncStorage.setItem('partnerExpoToken', token);
    } catch (e) {
      console.error('Partner notify register error:', e);
    }
  },
};

type Sub = ReturnType<typeof Notifications.addNotificationReceivedListener>;

// Decide where a tapped notification should take the driver.
function routeFor(data: any) {
  if (!data) return;
  switch (data.type) {
    case 'NEW_JOB':            // a delivery appeared on the driver's route
    case 'NEW_PARCEL':
      router.push('/(tabs)/home');
      break;
    case 'DELIVERY_DONE':      // a completed delivery
      router.push('/history' as any);
      break;
    default:
      if (data.screen === 'home') router.push('/(tabs)/home');
      else if (data.screen === 'history') router.push('/history' as any);
  }
}

export const PartnerNotificationListener: React.FC = () => {
  const recv = useRef<Sub | null>(null);
  const resp = useRef<Sub | null>(null);

  useEffect(() => {
    // cold start: app opened by tapping a notification
    Notifications.getLastNotificationResponseAsync()
      .then((r) => { if (r) routeFor(r.notification.request.content.data); })
      .catch(() => {});

    recv.current = Notifications.addNotificationReceivedListener((n) =>
      console.log('Partner notification:', n.request.content.title)
    );
    resp.current = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFor(response.notification.request.content.data as any);
    });
    return () => { recv.current?.remove(); resp.current?.remove(); };
  }, []);

  return null;
};
