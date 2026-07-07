import { addRequestInterceptor, addResponseInterceptor } from './request';
import { globalMessage } from './message-bridge';
import { useI18nStore } from './i18n';

const SKIP_REFRESH_ENDPOINTS = ['/api/auth/refresh', '/api/auth/login', '/api/auth/register'];
const PUBLIC_PATHS = ['/login', '/register'];
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000; // 5 分钟

let lastRefreshTime = 0;
let isLoggingOut = false;

// 注入的回调函数（避免循环依赖）
let _logout: ((saveRedirect?: boolean) => void) | null = null;
let _apiRefreshToken: (() => Promise<{ access_token: string }>) | null = null;

export function initInterceptorCallbacks(
  logoutFn: (saveRedirect?: boolean) => void,
  refreshFn: () => Promise<{ access_token: string }>,
) {
  _logout = logoutFn;
  _apiRefreshToken = refreshFn;
}

function getT() {
  return useI18nStore.getState().locale === 'fr'
    ? {
        no_token: 'Veuillez vous connecter pour continuer',
        session_expired: 'Votre session a expiré, veuillez vous reconnecter',
      }
    : {
        no_token: 'Please log in to continue',
        session_expired: 'Your session has expired, please log in again',
      };
}

// 请求拦截器：无 token 时（非公开页面）提示并登出
addRequestInterceptor((config) => {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    const headers = config.headers as Record<string, string>;
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined' && !PUBLIC_PATHS.includes(window.location.pathname)) {
    if (!isLoggingOut) {
      isLoggingOut = true;
      const t = getT();
      globalMessage.error(t.no_token);
      setTimeout(() => _logout?.(true), 1500);
    }
  }
  return config;
});

// 响应拦截器：401 登出（防重复）+ 成功时按冷却时间刷新 token
addResponseInterceptor(async (res, endpoint) => {
  if (res.status === 401 && !SKIP_REFRESH_ENDPOINTS.includes(endpoint)) {
    if (!isLoggingOut) {
      isLoggingOut = true;
      const t = getT();
      globalMessage.error(t.session_expired);
      setTimeout(() => _logout?.(true), 1500);
    }
    return res;
  }

  if (res.ok && !SKIP_REFRESH_ENDPOINTS.includes(endpoint)) {
    const token = sessionStorage.getItem('access_token');
    const now = Date.now();
    if (token && now - lastRefreshTime > REFRESH_COOLDOWN_MS) {
      lastRefreshTime = now;
      _apiRefreshToken?.().then((data) => {
        sessionStorage.setItem('access_token', data.access_token);
      }).catch(() => {});
    }
  }

  return res;
});
