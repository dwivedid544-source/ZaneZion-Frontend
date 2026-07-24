const getApiBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_URL || 'https://zanezion-backend-production-a303.up.railway.app/api/v1';
  envUrl = envUrl.replace(/\/+$/, '');
  if (!envUrl.endsWith('/api/v1')) {
    if (envUrl.endsWith('/api')) return `${envUrl}/v1`;
    if (envUrl.endsWith('/v1')) return envUrl.replace(/\/v1$/, '/api/v1');
    return `${envUrl}/api/v1`;
  }
  return envUrl;
};
export const API_BASE_URL = getApiBaseUrl();
export const API_URL = API_BASE_URL;
export const BACKEND_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'https://zanezion-backend-production-a303.up.railway.app';

export const toAbsoluteImageUrl = (rawPath) => {
  if (!rawPath) return null;
  if (typeof rawPath === 'object' && rawPath != null && typeof rawPath.url === 'string') {
    return toAbsoluteImageUrl(rawPath.url);
  }
  if (typeof rawPath !== 'string') return null;
  const trimmed = rawPath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/\\/g, '/')}`;
  return `${BACKEND_ORIGIN}${path}`;
};
