import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

export async function registerForPushNotificationsAsync(userId: string) {
  let token;

  if (Platform.OS === 'web') return;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.expoConfig?.extra?.projectId;
        if (!projectId) {
          console.log('Skipping push notifications: No EAS projectId configured.');
          return;
        }

        // On Android, check if google-services is configured to prevent native FirebaseApp not initialized crash
        const hasGoogleServices = !!Constants.expoConfig?.android?.googleServicesFile;
        if (Platform.OS === 'android' && !hasGoogleServices) {
          console.log('Skipping push token fetch: Firebase google-services.json is not configured for Android.');
          return;
        }

        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('Push Token:', token);
        
        if (token) {
          await api.updateUserPushToken(userId, token);
        }
    } catch (e) {
        console.warn('Failed to fetch push token:', e);
    }
  } else {
    // console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

export function setupNotificationHandlers() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });

    const subscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification Received:', notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification Response:', response);
    });

    return () => {
        subscription.remove();
        responseSubscription.remove();
    };
}
