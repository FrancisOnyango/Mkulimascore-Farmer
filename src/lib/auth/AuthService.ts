import { clearAccessToken, getAccessToken, setAccessToken } from '@/lib/auth/tokenStore';
import { clearStoredMsid, setStoredMsid } from '@/lib/session/sessionStore';
import { isPlausibleKenyaPhone } from '@/lib/phone/kenya';
import {
  isTrialChallenge,
  isTrialOtp,
  isTrialPhone,
  TRIAL_CHALLENGE_ID,
  TRIAL_MSID,
  TRIAL_SESSION_TOKEN
} from '@/lib/auth/trialCredentials';
import * as Crypto from 'expo-crypto';

export interface AuthSession {
  accessToken: string;
  msid: string;
  userId?: number;
  email?: string;
}

export interface AuthService {
  requestOtp(phone: string): Promise<{ challengeId: string }>;
  verifyOtp(challengeId: string, code: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}

class DemoAuthService implements AuthService {
  async requestOtp(phone: string) {
    if (isTrialPhone(phone)) return { challengeId: TRIAL_CHALLENGE_ID };
    if (phone.trim().length < 9) throw new Error('PHONE_INVALID');
    return { challengeId: 'demo-otp-challenge' };
  }

  async verifyOtp(challengeId: string, code: string) {
    if (isTrialChallenge(challengeId)) {
      if (!isTrialOtp(code)) throw new Error('OTP_INVALID');
      return createTrialSession();
    }
    if (!challengeId || code.trim().length < 4) throw new Error('OTP_INVALID');
    const session: AuthSession = {
      accessToken: 'demo-local-session-token',
      msid: 'MS-KE-DEMO-004829'
    };
    await setAccessToken(session.accessToken);
    await setStoredMsid(session.msid);
    return session;
  }

  async signOut() {
    await clearAccessToken();
    await clearStoredMsid();
  }
}

class ProductionAuthService implements AuthService {
  constructor(private readonly baseUrl: string) {}

  async requestOtp(identifier: string) {
    const normalized = identifier.trim();
    if (isTrialPhone(normalized)) return { challengeId: TRIAL_CHALLENGE_ID };
    if (normalized.length < 3) throw new Error('IDENTIFIER_INVALID');
    if (isAccountLogin(normalized)) {
      return { challengeId: `staff:${normalized}` };
    }
    const response = await fetch(`${this.baseUrl}/api/v1/farmer/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': Crypto.randomUUID() },
      body: JSON.stringify({ phone: normalized })
    });
    if (!response.ok) throw new Error(`OTP_REQUEST_FAILED_${response.status}`);
    const result = (await response.json()) as { challengeId?: string };
    if (!result.challengeId) throw new Error('OTP_REQUEST_FAILED');
    return { challengeId: `otp:${result.challengeId}` };
  }

  async verifyOtp(challengeId: string, code: string) {
    if (isTrialChallenge(challengeId)) {
      if (!isTrialOtp(code)) throw new Error('OTP_INVALID');
      return createTrialSession();
    }
    if (challengeId.startsWith('staff:')) {
      return this.verifyStaffPassword(challengeId.slice('staff:'.length), code);
    }
    const otpChallenge = challengeId.startsWith('otp:') ? challengeId.slice('otp:'.length) : challengeId;
    const response = await fetch(`${this.baseUrl}/api/v1/farmer/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': Crypto.randomUUID() },
      body: JSON.stringify({ challengeId: otpChallenge, code })
    });
    if (!response.ok) throw new Error(`OTP_INVALID_${response.status}`);
    const result = (await response.json()) as { access_token?: string; msid?: string; farmer_msid?: string };
    if (!result.access_token) throw new Error('OTP_INVALID');
    const msid = result.msid || result.farmer_msid || '';
    await setAccessToken(result.access_token);
    await setStoredMsid(msid);
    return { accessToken: result.access_token, msid };
  }

  private async verifyStaffPassword(username: string, password: string) {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);
    body.append('grant_type', 'password');

    const response = await fetch(`${this.baseUrl}/api/v1/auth/login/access-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!response.ok) throw new Error(`LOGIN_FAILED_${response.status}`);

    const token = (await response.json()) as { access_token: string };
    await setAccessToken(token.access_token);

    const me = await this.readCurrentUser(token.access_token);
    const session: AuthSession = {
      accessToken: token.access_token,
      msid: process.env.EXPO_PUBLIC_BACKEND_FARMER_MSID ?? `USER-${me.id}`,
      userId: me.id,
      email: me.email
    };
    await setStoredMsid(session.msid);
    return session;
  }

  async signOut() {
    const token = await getAccessToken();
    try {
      if (token) {
        await fetch(`${this.baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } finally {
      await clearAccessToken();
      await clearStoredMsid();
    }
  }

  private async readCurrentUser(token: string) {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`PROFILE_FAILED_${response.status}`);
    return (await response.json()) as { id: number; email: string };
  }
}

export function createAuthService(): AuthService {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (mode === 'demo') return new DemoAuthService();
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL is required outside demo mode.');
  return new ProductionAuthService(baseUrl.replace(/\/$/, ''));
}

function isAccountLogin(value: string) {
  return value.includes('@') || !isPlausibleKenyaPhone(value);
}

async function createTrialSession(): Promise<AuthSession> {
  const session: AuthSession = {
    accessToken: TRIAL_SESSION_TOKEN,
    msid: TRIAL_MSID
  };
  await setAccessToken(session.accessToken);
  await setStoredMsid(session.msid);
  return session;
}
