import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import api from '@/utils/api';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Android plays custom sounds only via a channel configured with that sound.
// Must match the backend push payload's channelId: 'default'.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('sukobin_alerts', {
    name: 'Sukobin Alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'notification.wav',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0C831F',
  }).catch(() => {});
}

export class NotificationService {
  // Get Expo push token
  static async getExpoPushToken(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Must use physical device for push notifications');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    try {
      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync({
         projectId: Constants?.expoConfig?.extra?.eas?.projectId,
      });
      
      console.log('Expo Push Token:', token.data);
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Send token to backend
  static async sendTokenToBackend(token: string): Promise<boolean> {
    try {
      const response = await api.post('/api/user/notify', {
        token
      });
      
      console.log('Token saved to backend:', response);
      return response.success === true;
    } catch (error) {
      console.error('Error sending token to backend:', error);
      return false;
    }
  }

  // Save token locally
  static async saveTokenLocally(token: string): Promise<void> {
    await AsyncStorage.setItem('expoPushToken', token);
  }

  // Get stored token
  static async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem('expoPushToken');
  }

  // Initialize push notifications
  static async initialize(): Promise<void> {
    try {
      // Check if user is logged in
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        console.log('User not logged in, skipping push notifications');
        return;
      }

      // Get existing token from storage
      const storedToken = await this.getStoredToken();
      
      // Get fresh token
      const token = await this.getExpoPushToken();
      if (!token) {
        console.log('Failed to get Expo push token');
        return;
      }

      // If token changed or no stored token, send to backend
      if (token !== storedToken) {
        console.log('New token detected, sending to backend...');
        const saved = await this.sendTokenToBackend(token);
        if (saved) {
          await this.saveTokenLocally(token);
          console.log('Token saved successfully');
        } else {
          console.log('Failed to save token to backend');
        }
      } else {
        console.log('Token unchanged, skipping save');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }
}