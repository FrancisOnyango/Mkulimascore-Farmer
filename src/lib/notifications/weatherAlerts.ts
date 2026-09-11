import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getAccessToken } from '@/lib/auth/tokenStore';

export type WeatherAlertRegistration = {
  enabled: boolean;
  permission: Notifications.PermissionStatus | 'unsupported' | 'backend-unavailable';
  token?: string;
};

/**
 * Registers the device for severe-weather alerts. The API call is deliberately
 * optional: without a configured production endpoint the device remains local
 * and no alert claim is made.
 */
export async function registerSevereWeatherAlerts(enabled: boolean): Promise<WeatherAlertRegistration> {
  if (!enabled || Platform.OS === 'web') return { enabled, permission: 'unsupported' };
  try {
    return await registerSevereWeatherAlertsUnsafe(enabled);
  } catch {
    return { enabled, permission: 'unsupported' };
  }
}

async function registerSevereWeatherAlertsUnsafe(enabled: boolean): Promise<WeatherAlertRegistration> {
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== Notifications.PermissionStatus.GRANTED) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== Notifications.PermissionStatus.GRANTED) return { enabled, permission: status };

  await Notifications.setNotificationChannelAsync('severe-weather', {
    name: 'Severe weather',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default'
  });
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { enabled, permission: status };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  if (mode !== 'demo' && baseUrl) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const response = await fetch(`${baseUrl}/api/v1/farmer/alerts/severe-weather/registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Request-ID': requestId
        },
        body: JSON.stringify({ token, platform: Platform.OS, alertType: 'severe_weather', requestId })
      });
      if (!response.ok) return { enabled, permission: 'backend-unavailable', token };
    }
  }
  return { enabled, permission: status, token };
}
