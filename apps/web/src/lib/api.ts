import { useAppStore } from '../stores/useAppStore';

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken, refreshToken, setSession, clearSession } = useAppStore.getState();

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry && refreshToken && !path.startsWith('/auth/')) {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const data = (await refreshRes.json()) as {
          accessToken: string;
          refreshToken: string;
          user: ReturnType<typeof useAppStore.getState>['user'];
        };
        if (data.user) {
          setSession({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            user: data.user,
          });
          return apiRequest<T>(path, options, false);
        }
      } else {
        clearSession();
      }
    } catch {
      clearSession();
    }
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errObj = payload?.error ?? {};
    throw new ApiClientError(
      res.status,
      errObj.code || 'API_ERROR',
      errObj.message || 'Request failed. Please try again.',
      errObj.details,
    );
  }

  return payload as T;
}

