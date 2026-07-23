import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/v1') ? envUrl : `${envUrl}/v1`;
  }
  return 'https://zanezion-backend-production.up.railway.app/api/v1';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Request Interceptor: Add Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      const hadToken = !!localStorage.getItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('userRole');
      
      const publicRoutes = ['/', '/login', '/signup', '/staff-signup'];
      if (!publicRoutes.includes(window.location.pathname)) {
        window.location.href = '/login';
      } else if (hadToken) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
