/**
 * Thin fetch wrapper.
 *
 * Never calls res.json() blind: Cloudflare answers with an HTML error page
 * when it cuts a request, and parsing that yields "Unexpected token '<'",
 * which says nothing about what actually happened.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function jsonOrThrow(res: Response): Promise<unknown> {
  const type = res.headers.get('content-type') ?? '';

  if (!type.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (res.status === 524 || /cloudflare/i.test(text)) {
      throw new ApiError('The server took too long and the connection was cut.', 524);
    }
    throw new ApiError(`The server responded ${res.status} without JSON.`, res.status);
  }

  const data = (await res.json()) as { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  }
  return data;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return (await jsonOrThrow(res)) as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

/* ------------------------------------------------------------------ *
 * Shared shapes
 * ------------------------------------------------------------------ */

export interface SessionUser {
  id: number;
  name: string;
  surname: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface AdminUser extends SessionUser {
  isOwner: boolean;
  activeSessions: number;
}

export interface AdminOverview {
  users: number;
  admins: number;
  activeSessions: number;
  storedKeys: number;
  uptimeSeconds: number;
  node: string;
  registrationOpen: boolean;
}
