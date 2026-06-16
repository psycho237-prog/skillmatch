import { Platform } from 'react-native';
import Constants from 'expo-constants';

export async function registerForPushNotificationsAsync(userId: string) {
  console.log('Push notifications disabled in Expo Go (SDK 53+)');
  return null;
}

export function setupNotificationHandlers() {
  console.log('Push notifications handlers disabled in Expo Go (SDK 53+)');
  return () => {};
}
