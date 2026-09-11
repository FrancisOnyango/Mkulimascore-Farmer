import { digitsOnly, normalizeKenyaPhone } from '@/lib/phone/kenya';

export const TRIAL_PHONE_DISPLAY = '0712 000 360';
export const TRIAL_PHONE = '0712000360';
export const TRIAL_OTP = '246810';
export const TRIAL_CHALLENGE_ID = 'trial-otp-challenge';
export const TRIAL_MSID = 'MS-KE-TRIAL-000360';
export const TRIAL_SESSION_TOKEN = 'trial-local-session-token';

export function trialAccessEnabled() {
  return (process.env.EXPO_PUBLIC_APP_MODE ?? 'demo') !== 'production';
}

export function isTrialPhone(value: string) {
  return normalizeKenyaPhone(value) === normalizeKenyaPhone(TRIAL_PHONE);
}

export function isTrialOtp(value: string) {
  return digitsOnly(value) === TRIAL_OTP;
}

export function isTrialChallenge(challengeId: string) {
  return challengeId === TRIAL_CHALLENGE_ID;
}
