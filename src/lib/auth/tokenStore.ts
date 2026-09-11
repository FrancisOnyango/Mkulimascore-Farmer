import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mkulima_farmer_access_token';

export async function getAccessToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAccessToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearAccessToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
