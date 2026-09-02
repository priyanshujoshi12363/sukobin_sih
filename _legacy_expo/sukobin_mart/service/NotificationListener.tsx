import React, { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

type Sub = ReturnType<typeof Notifications.addNotificationReceivedListener>;

export const NotificationListener: React.FC = () => {
  const receivedRef = useRef<Sub | null>(null);
  const responseRef = useRef<Sub | null>(null);

  const routeFromData = (data: any) => {
    if (!data) return;
    if (data.type === 'NEW_ORDER' || data.screen === 'orders') {
      router.push('/(tabs)/orders');
    } else if (typeof data.screen === 'string') {
      router.push(data.screen as any);
    }
  };

  useEffect(() => {
    // Foreground notifications
    receivedRef.current = Notifications.addNotificationReceivedListener((n) => {
      console.log('Merchant notification received:', n.request.content.title);
    });

    // Notification taps
    responseRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Merchant notification tapped:', data);
      routeFromData(data);
    });

    // App opened from a notification (cold start)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) routeFromData(response.notification.request.content.data);
    });

    return () => {
      receivedRef.current?.remove();
      responseRef.current?.remove();
    };
  }, []);

  return null;
};
