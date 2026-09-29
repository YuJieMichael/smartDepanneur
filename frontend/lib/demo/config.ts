export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const DEMO_ROUTES = ['/', '/login', '/dashboard', '/sales', '/products', '/categories', '/suppliers', '/inventory', '/insights'];

export function appPath(path: string) {
  const withoutBase = BASE_PATH && path.startsWith(`${BASE_PATH}/`) ? path.slice(BASE_PATH.length) : path;
  return withoutBase.replace(/\/$/, '') || '/';
}

export function publicPath(path: string) {
  return `${BASE_PATH}${path}`;
}

export const AUTH_STORAGE_KEY = DEMO_MODE ? 'smartdepanneur-preview-session' : 'access_token';
