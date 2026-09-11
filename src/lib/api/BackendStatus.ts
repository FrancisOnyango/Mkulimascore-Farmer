import { getLastProjectionAt } from '@/db/database';

export interface BackendStatus {
  mode: string;
  baseUrl: string | null;
  reachable: boolean;
  statusText: string;
  lastProjectionAt: string | null;
  writes: string;
}

export async function getBackendStatus(): Promise<BackendStatus> {
  const mode = process.env.EXPO_PUBLIC_APP_MODE ?? 'demo';
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? null;
  const lastProjectionAt = (await getLastProjectionAt()) ?? null;
  const writes = 'Farmer writes go as evidence envelopes to /api/v1/farmer/submissions. The app never writes scores.';

  if (mode === 'demo') {
    return {
      mode,
      baseUrl,
      reachable: true,
      statusText: 'Demo mode uses local data and simulated sync.',
      lastProjectionAt,
      writes
    };
  }
  if (!baseUrl) {
    return {
      mode,
      baseUrl,
      reachable: false,
      statusText: 'EXPO_PUBLIC_API_BASE_URL is not configured.',
      lastProjectionAt,
      writes
    };
  }

  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      return {
        mode,
        baseUrl,
        reachable: false,
        statusText: `Backend responded with HTTP ${response.status}.`,
        lastProjectionAt,
        writes
      };
    }
    const body = (await response.json()) as { status?: string };
    return {
      mode,
      baseUrl,
      reachable: body.status === 'healthy',
      statusText: body.status === 'healthy' ? 'Live backend health check passed.' : `Backend status: ${body.status ?? 'unknown'}.`,
      lastProjectionAt,
      writes
    };
  } catch {
    return {
      mode,
      baseUrl,
      reachable: false,
      statusText: 'Backend health check failed. Saved farm data on this phone is still available.',
      lastProjectionAt,
      writes
    };
  }
}
