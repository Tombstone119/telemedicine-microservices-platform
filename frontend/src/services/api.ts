import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { authStorageKeys } from '../context/AuthContext';

const api = axios.create({
  baseURL: 'http://localhost/api',
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
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
