import * as SecureStore from 'expo-secure-store';

const MSID_KEY = 'mkulima_farmer_msid';
const NATIONAL_ID_KEY = 'mkulima_farmer_national_id';

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

/** Full national ID for institution matching. Never put this in Ask packets or analytics. */
export async function getStoredNationalId() {
  return SecureStore.getItemAsync(NATIONAL_ID_KEY);
}

export async function setStoredNationalId(nationalId: string) {
  if (!nationalId) return;
  await SecureStore.setItemAsync(NATIONAL_ID_KEY, nationalId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}

export async function clearStoredNationalId() {
  await SecureStore.deleteItemAsync(NATIONAL_ID_KEY);
}
