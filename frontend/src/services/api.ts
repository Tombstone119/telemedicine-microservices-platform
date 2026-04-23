import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorageKeys } from '../context/AuthContext';

function normalizeBaseURL(value: string) {
  return value.replace(/\/$/, '');
}

function resolveBaseURL() {
  const configured = process.env.REACT_APP_API_BASE_URL?.trim();

  // In local dev, prefer relative /api so CRA proxy handles requests without browser CORS checks.
  if (process.env.NODE_ENV === 'development') {
    if (!configured) return '/api';
    if (/^https?:\/\/localhost(?::\d+)?\/api\/?$/i.test(configured)) return '/api';
  }

  return normalizeBaseURL(configured || '/api');
}

const baseURL = resolveBaseURL();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(authStorageKeys.token);
  if (token) {
    config.headers = config.headers ?? {};

    const hasExplicitAuthorization =
      (typeof (config.headers as any).get === 'function' &&
        Boolean((config.headers as any).get('Authorization'))) ||
      Boolean((config.headers as any).Authorization) ||
      Boolean((config.headers as any).authorization);

    if (!hasExplicitAuthorization) {
      if (typeof (config.headers as any).set === 'function') {
        (config.headers as any).set('Authorization', `Bearer ${token}`);
      } else {
        (config.headers as any).Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(authStorageKeys.token);
      localStorage.removeItem(authStorageKeys.user);
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
