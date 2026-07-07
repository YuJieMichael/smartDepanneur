const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * 请求拦截器列表
 * 每个拦截器接收 RequestInit，返回修改后的 RequestInit
 */
const requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];

/**
 * 响应拦截器列表
 * 每个拦截器接收 Response 和 endpoint，返回处理后的 Response（或抛错）
 */
const responseInterceptors: Array<(res: Response, endpoint: string) => Response | Promise<Response>> = [];

/** 添加请求拦截器 */
export function addRequestInterceptor(fn: (config: RequestInit) => RequestInit) {
  requestInterceptors.push(fn);
}

/** 添加响应拦截器 */
export function addResponseInterceptor(fn: (res: Response, endpoint: string) => Response | Promise<Response>) {
  responseInterceptors.push(fn);
}

/** 自定义错误类，携带 HTTP 状态码 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 封装的请求函数 */
export async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // 执行请求拦截器
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

  // 执行响应拦截器
  for (const interceptor of responseInterceptors) {
    res = await interceptor(res, endpoint);
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '请求失败' }));
    throw new ApiError(res.status, error.message ?? '请求失败');
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
