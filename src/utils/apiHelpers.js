export const getApiBaseUrl = () => {
  let envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) {
    const envMode = (import.meta.env.VITE_ENV_MODE || '').trim().toLowerCase();
    const localUrl = import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:8000/api/v1';
    const prodUrl = import.meta.env.VITE_API_URL_PROD || 'https://zanezoin-backend-production.up.railway.app/api/v1';

    if (envMode === 'local' || envMode === 'dev' || envMode === 'development') {
      envUrl = localUrl;
    } else if (envMode === 'production' || envMode === 'prod' || envMode === 'live') {
      envUrl = prodUrl;
    } else if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      envUrl = localUrl;
    } else {
      envUrl = prodUrl;
    }
  }

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

export const getBackendOrigin = () => {
  if (import.meta.env.VITE_API_ORIGIN) {
    return import.meta.env.VITE_API_ORIGIN.replace(/\/+$/, '');
  }
  const base = getApiBaseUrl();
  return base.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
};

export const BACKEND_ORIGIN = getBackendOrigin();

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

const isGenericName = (name) => {
  if (!name) return true;
  const str = String(name).trim().toLowerCase();
  if (!str) return true;
  return /^\s*(person|personal\s*client|personal|guest|client|guest\s*client|unknown\s*client|null|undefined)\s*$/i.test(str);
};

export const formatClientDisplayName = (item, clients = [], users = []) => {
  if (!item) return 'Personal Client';

  if (typeof item === 'string') {
    const trimmed = item.trim();
    const clean = trimmed.replace(/\s*\(Personal Client\)/gi, '').trim();
    if (isGenericName(clean)) return 'Personal Client';
    return `${clean} (Personal Client)`;
  }

  let clientObj = item.client && typeof item.client === 'object' ? item.client : null;
  const cId = item.clientId || item.client_id || item.company_id || item.companyId;
  if (!clientObj && cId && Array.isArray(clients)) {
    const normCId = String(cId).replace('CLT-', '');
    clientObj = clients.find(c => String(c.id) === String(cId) || String(c.id).replace('CLT-', '') === normCId || (c.clientCode && c.clientCode === cId));
  }

  let userObj = item.user && typeof item.user === 'object' ? item.user : null;
  const uId = item.created_by || item.createdById || item.userId || item.user_id || item.customer_id || item.customerId;
  const uEmail = (item.email || item.user_email || item.customer_email || clientObj?.email || item.client?.email || '').toLowerCase();

  if (!userObj && Array.isArray(users)) {
    if (uId) {
      userObj = users.find(u => String(u.id) === String(uId));
    }
    if (!userObj && uEmail) {
      userObj = users.find(u => u.email && String(u.email).toLowerCase() === uEmail);
    }
  }

  if (!clientObj && Array.isArray(clients)) {
    if (uEmail) {
      clientObj = clients.find(c => c.email && String(c.email).toLowerCase() === uEmail);
    }
    if (!clientObj && uId) {
      clientObj = clients.find(c => String(c.userId || c.user_id || c.id) === String(uId));
    }
  }

  const candidates = [
    userObj?.name,
    userObj?.fullName,
    userObj?.full_name,
    clientObj?.contactPerson,
    clientObj?.contact_person,
    item.contactPerson,
    item.created_by_name,
    item.customer_name,
    item.passengerInfo?.name,
    item.passenger_info?.name,
    typeof item.client === 'string' ? item.client : null,
    typeof item.clientName === 'string' ? item.clientName : null,
    clientObj?.name,
    clientObj?.companyName
  ];

  let personName = null;
  for (const cand of candidates) {
    if (cand && typeof cand === 'string') {
      const cleanCand = cand.replace(/\s*\(Personal Client\)/gi, '').trim();
      if (!isGenericName(cleanCand)) {
        personName = cleanCand;
        break;
      }
    }
  }

  const rawCompany = clientObj?.companyName || clientObj?.business_name || (typeof item.client === 'string' ? item.client : item.clientName) || '';
  const cleanCompany = String(rawCompany).replace(/\s*\(Personal Client\)/gi, '').trim();
  const isPersonal = (
    clientObj?.type === 'personal' ||
    clientObj?.clientType === 'personal' ||
    clientObj?.client_type === 'personal' ||
    isGenericName(cleanCompany) ||
    !clientObj?.companyName ||
    Boolean(personName && isGenericName(cleanCompany))
  );

  if (isPersonal) {
    if (personName) {
      return `${personName} (Personal Client)`;
    }
    return 'Personal Client';
  }

  if (cleanCompany && !isGenericName(cleanCompany)) {
    return cleanCompany;
  }
  if (personName) {
    return `${personName} (Personal Client)`;
  }

  return 'Personal Client';
};
