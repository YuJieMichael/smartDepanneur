const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];
const responseInterceptors: Array<(res: Response, endpoint: string) => Response | Promise<Response>> = [];

export function addRequestInterceptor(fn: (config: RequestInit) => RequestInit) {
  requestInterceptors.push(fn);
}

export function addResponseInterceptor(fn: (res: Response, endpoint: string) => Response | Promise<Response>) {
  responseInterceptors.push(fn);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const { demoRequest } = await import('./demo/api');
    return demoRequest<T>(endpoint, options);
  }
  let config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  };

  for (const interceptor of requestInterceptors) {
    config = interceptor(config);
  }

  let res = await fetch(`${API_URL}${endpoint}`, config);

  for (const interceptor of responseInterceptors) {
    res = await interceptor(res, endpoint);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, error.message ?? 'Request failed');
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
