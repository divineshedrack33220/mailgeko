const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const TOKEN_KEY = "mailgeko_token";

// Endpoints that legitimately return 401 without meaning the session is dead
// (bad credentials, expired 2FA challenge, invalid reset link, …). These must
// never trigger a logout redirect.
const UNAUTHENTICATED_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/2fa/verify",
  "/api/v1/auth/oauth",
];

// Routes that don't need a redirect because the user is already there.
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify", "/2fa", "/invite"];

let redirectingToLogin = false;

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (redirectingToLogin) return;
  const current = window.location.pathname;
  if (AUTH_PAGES.some((p) => current === p || current.startsWith(p + "/"))) return;
  redirectingToLogin = true;
  const next = window.location.pathname + window.location.search;
  window.localStorage.removeItem(TOKEN_KEY);
  window.location.replace(`/login${next && next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`);
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    redirectingToLogin = false;
    window.localStorage.setItem(TOKEN_KEY, token);
  } else window.localStorage.removeItem(TOKEN_KEY);
}

export function oauthUrl(provider: "google" | "github"): string {
  return `${API_BASE}/api/v1/auth/oauth/${provider}`;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 30_000;
const UPLOAD_TIMEOUT = 120_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token && !options.skipAuth) headers.set("Authorization", `Bearer ${token}`);

  // A hung upstream must not hang the UI forever: abort after a timeout and
  // surface it as a network error so callers show a retryable message instead
  // of spinning indefinitely.
  const timeoutMs =
    options.timeoutMs ??
    (options.method === "POST" && options.body instanceof FormData
      ? UPLOAD_TIMEOUT
      : DEFAULT_TIMEOUT);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    throw new ApiError(0, "network", "Could not reach the API server");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let code = "error";
    try {
      const body = await res.json();
      if (typeof body.message === "string") message = body.message;
      if (typeof body.error === "string") code = body.error;
    } catch {
      // non-JSON error body
    }
    if (res.status === 401 && !options.skipAuth && !UNAUTHENTICATED_PATHS.some((p) => path.startsWith(p))) {
      redirectToLogin();
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  patch<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },
  upload<T>(path: string, file: File, field = "file"): Promise<T> {
    const formData = new FormData();
    formData.append(field, file);
    return request<T>(path, { method: "POST", body: formData });
  },
};
