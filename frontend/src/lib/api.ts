import axios from 'axios';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE_URL = configuredApiUrl || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const pendingFinancialRequests = new Map<string, string>();
let financialRequestOwner: string | null = null;
const financialPath = /^\/(transactions(?:\/[^/]+\/cancel)?|customer-deposits\/(?:deposit|[^/]+\/withdrawals)|internet-credits\/[^/]+\/payments|cash-sessions\/(?:add-cash|withdraw-cash))$/;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (process.env.NODE_ENV === 'development' && config.method === 'post' && financialPath.test(config.url ?? '') && !config.headers.has('Idempotency-Key')) {
    if (financialRequestOwner !== token) { pendingFinancialRequests.clear(); financialRequestOwner = token; }
    const identity = JSON.stringify([config.url, config.data]);
    if (!pendingFinancialRequests.has(identity)) pendingFinancialRequests.set(identity, crypto.randomUUID());
    config.headers.set('Idempotency-Key', pendingFinancialRequests.get(identity)!);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const key = response.config.headers.get('Idempotency-Key');
    if (key) pendingFinancialRequests.forEach((value, identity) => { if (value === key) pendingFinancialRequests.delete(identity); });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isAuthUrl = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthUrl) {
      originalRequest._retry = true;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const { accessToken } = res.data.data;
        localStorage.setItem('accessToken', accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem('accessToken');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
