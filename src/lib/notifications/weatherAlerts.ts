export type WeatherAlertRegistration = {
  enabled: boolean;
  permission: string;
  token?: string;
};

/**
 * Push registration is disabled in this Android build so a missing
 * Firebase / Expo project cannot take the app down at launch.
 */
export async function registerSevereWeatherAlerts(enabled: boolean): Promise<WeatherAlertRegistration> {
  return { enabled, permission: 'unsupported' };
}
