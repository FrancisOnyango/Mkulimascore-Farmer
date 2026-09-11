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
      statusText: 'Demo mode uses the local farmer-safe assistant.'
    };
  }

  if (!baseUrl || !endpoint) {
    return {
      mode,
      state: 'misconfigured',
      baseUrl,
      endpoint,
      statusText: 'Production AI needs EXPO_PUBLIC_API_BASE_URL.'
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      mode,
      state: 'auth_required',
      baseUrl,
      endpoint,
      statusText: 'Sign in is required before using the live Ask Mkulima service.'
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
      return { mode, state: 'auth_required', baseUrl, endpoint, statusText: 'AI service rejected the current session. Sign in again.' };
    }
    if (response.status === 404) {
      return { mode, state: 'unavailable', baseUrl, endpoint, statusText: 'Ask Mkulima backend endpoint is not deployed yet.' };
    }
    if (!response.ok) {
      return { mode, state: 'unavailable', baseUrl, endpoint, statusText: `AI service health returned HTTP ${response.status}.` };
    }
    const body = await response.json() as { status?: string; model?: string; policy?: string };
    const modelText = body.model ? ` Model: ${body.model}.` : '';
    const policyText = body.policy ? ` Policy: ${body.policy}.` : '';
    return {
      mode,
      state: body.status === 'healthy' ? 'ready' : 'unavailable',
      baseUrl,
      endpoint,
      statusText: body.status === 'healthy' ? `Live Ask Mkulima is ready.${modelText}${policyText}` : `AI service status: ${body.status ?? 'unknown'}.`
    };
  } catch (error) {
    return {
      mode,
      state: 'unavailable',
      baseUrl,
      endpoint,
      statusText: error instanceof Error && error.name === 'AbortError' ? 'AI service health timed out.' : 'AI service health check failed.'
    };
  } finally {
    clearTimeout(timeout);
  }
}
