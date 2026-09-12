import { getAccessToken } from '@/lib/auth/tokenStore';

export type AskMkulimaIntegrationMode = 'demo' | 'production';
export type AskMkulimaIntegrationState = 'local_demo' | 'ready' | 'auth_required' | 'misconfigured' | 'unavailable';

export interface AskMkulimaIntegrationStatus {
  mode: AskMkulimaIntegrationMode;
  state: AskMkulimaIntegrationState;
  baseUrl: string | null;
  endpoint: string | null;
  statusText: string;
}

export function getAskMkulimaEndpoint(baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL) {
  const normalized = baseUrl?.replace(/\/$/, '') ?? null;
  return normalized ? `${normalized}/api/v1/farmer/ask-mkulima` : null;
}

export async function getAskMkulimaIntegrationStatus(): Promise<AskMkulimaIntegrationStatus> {
  const mode = (process.env.EXPO_PUBLIC_APP_MODE ?? 'demo') === 'demo' ? 'demo' : 'production';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? null;
  const endpoint = getAskMkulimaEndpoint(baseUrl ?? undefined);

  if (mode === 'demo') {
    return {
      mode,
      state: 'local_demo',
      baseUrl,
      endpoint,
      statusText: 'On this phone. Uses your saved farm records.'
    };
  }

  if (!baseUrl || !endpoint) {
    return {
      mode,
      state: 'misconfigured',
      baseUrl,
      endpoint,
      statusText: 'Live assistant is not configured. Answers stay on this phone.'
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      mode,
      state: 'auth_required',
      baseUrl,
      endpoint,
      statusText: 'Sign in if you want the live assistant. You can still ask from this phone.'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${endpoint}/health`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: controller.signal
    });
    if (response.status === 401 || response.status === 403) {
      return { mode, state: 'auth_required', baseUrl, endpoint, statusText: 'Sign in again if you want the live assistant.' };
    }
    if (response.status === 404) {
      return { mode, state: 'unavailable', baseUrl, endpoint, statusText: 'Live assistant is not on this server yet. Answers stay on this phone.' };
    }
    if (!response.ok) {
      return { mode, state: 'unavailable', baseUrl, endpoint, statusText: 'Live assistant is busy. Answers stay on this phone.' };
    }
    const body = await response.json() as { status?: string; model?: string; provider?: string };
    const live = body.status === 'healthy';
    const via = body.provider === 'xai' || body.provider === 'groq' ? ' Live rewrite is on.' : '';
    return {
      mode,
      state: live ? 'ready' : 'unavailable',
      baseUrl,
      endpoint,
      statusText: live ? `Live Ask Mkulima is ready.${via}` : 'Live assistant is not ready. Answers stay on this phone.'
    };
  } catch (error) {
    return {
      mode,
      state: 'unavailable',
      baseUrl,
      endpoint,
      statusText: 'Live assistant could not be reached. Answers stay on this phone.'
    };
  } finally {
    clearTimeout(timeout);
  }
}
