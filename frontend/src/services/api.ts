import axios from 'axios';
import type { ApiSuccess, Paginated } from '../types';

export const TOKEN_KEY = 'hqms_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? '';
    if (error.response?.status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('hqms:unauthorized'));
    }
    return Promise.reject(error);
  },
);

export async function getData<T>(url: string, params?: object): Promise<T> {
  const res = await api.get<ApiSuccess<T>>(url, { params });
  return res.data.data;
}

export async function getPage<T>(url: string, params?: object): Promise<Paginated<T>> {
  const res = await api.get<ApiSuccess<T[]>>(url, { params });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function send<T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: object) {
  const res = await api.request<ApiSuccess<T>>({ method, url, data: body });
  return { data: res.data.data, message: res.data.message };
}
