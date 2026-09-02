import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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
    lightColor: '#0C831F',
  }).catch(() => {});
}

export class MerchantNotificationService {
  // Request permission + fetch the Expo push token
  static async getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Must use a physical device for push notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push permission not granted for merchant');
      return null;
    }

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        (Constants as any)?.easConfig?.projectId;
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      console.log('Merchant Expo Push Token:', token.data);
      return token.data;
    } catch (error) {
      console.error('Error getting merchant push token:', error);
      return null;
    }
  }

  // Send token to backend → POST /api/merchant/notify { expoPushToken }
  static async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      const response = await api.post('/api/merchant/notify', { expoPushToken: token });
      console.log('Merchant token saved to backend:', response);
      return response?.success === true;
    } catch (error) {
      console.error('Error sending merchant token to backend:', error);
      return false;
    }
  }

  static async saveTokenLocally(token: string): Promise<void> {
    await AsyncStorage.setItem('merchantExpoPushToken', token);
  }

  static async getStoredToken(): Promise<string | null> {
    return AsyncStorage.getItem('merchantExpoPushToken');
  }

  // Initialise: only if a merchant is logged in; send token if it changed
  static async initialize(): Promise<void> {
    try {
      const merchantToken = await AsyncStorage.getItem('merchantToken');
      if (!merchantToken) {
        console.log('Merchant not logged in, skipping push notifications');
        return;
      }

      const storedToken = await this.getStoredToken();
      const token = await this.getExpoPushToken();
      if (!token) {
        console.log('Failed to get merchant Expo push token');
        return;
      }

      if (token !== storedToken) {
        console.log('New merchant token detected, sending to backend...');
        const saved = await this.sendTokenToBackend(token);
        if (saved) {
          await this.saveTokenLocally(token);
          console.log('Merchant token saved successfully');
        } else {
          console.log('Failed to save merchant token to backend');
        }
      } else {
        console.log('Merchant token unchanged, skipping save');
      }
    } catch (error) {
      console.error('Error initialising merchant push notifications:', error);
    }
  }
}
