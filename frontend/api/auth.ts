import { request, ApiError } from '@/lib/request';
import { User, useAppStore } from '@/lib/store';

export interface LoginResponse {
  access_token: string;
}

export function apiGetCurrentUser() {
  return request<User>('/api/auth/getCurrentUser');
}

export function apiRefreshToken() {
  return request<LoginResponse>('/api/auth/refresh');
}

export function apiLogin(email: string, password: string) {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function apiCheckEmailExists(email: string) {
  return request<{ exists: boolean }>('/api/auth/checkEmailExists', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function apiRegister(email: string, password: string, roles: string[]) {
  return request<{ id: number; email: string; message: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, roles }),
  });
}

export function apiCreateUser(email: string, password: string, roles: string[]) {
  return request<{ id: number; email: string; message: string }>('/api/auth/createUser', {
    method: 'POST',
    body: JSON.stringify({ email, password, roles }),
  });
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const user = await apiGetCurrentUser();
    useAppStore.getState().setCurrentUser(user);
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      logout();
    }
    return null;
  }
}

let _loggingOut = false;
export function logout(saveRedirect = true) {
  if (_loggingOut) return;
  _loggingOut = true;
  sessionStorage.removeItem('access_token');
  useAppStore.getState().setCurrentUser(null);
  if (saveRedirect) {
    const current = window.location.pathname + window.location.search;
    const redirect = current !== '/login' ? `?redirect=${encodeURIComponent(current)}` : '';
    window.location.replace(`/login${redirect}`);
  } else {
    window.location.replace('/login');
  }
}
