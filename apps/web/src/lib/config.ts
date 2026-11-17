export const HARDCODED_API_URL = 'https://autodeyapi-production.up.railway.app';

export const API_BASE_URL: string = (() => {
  try {
    const metaEnv = (import.meta as unknown as { env?: { VITE_API_URL?: string } })?.env;
    const envUrl = metaEnv?.VITE_API_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch {
    // Fallback for non-browser/test environments
  }
  return HARDCODED_API_URL;
})();
