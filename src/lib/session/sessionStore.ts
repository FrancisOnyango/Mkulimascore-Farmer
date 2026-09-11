import * as SecureStore from 'expo-secure-store';

const MSID_KEY = 'mkulima_farmer_msid';

export async function getStoredMsid() {
  return SecureStore.getItemAsync(MSID_KEY);
}

export async function setStoredMsid(msid: string) {
  if (!msid) return;
  await SecureStore.setItemAsync(MSID_KEY, msid, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearStoredMsid() {
  await SecureStore.deleteItemAsync(MSID_KEY);
}
