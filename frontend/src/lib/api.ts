const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

const withBase = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

async function parseJsonSafe<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(`API ${res.status}: invalid JSON response`);
    }
  }
  throw new Error(text || `API ${res.status}: empty response`);
}

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(withBase(path), { headers });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API ${res.status}: ${error}`);
  }
  return parseJsonSafe<T>(res);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
  timeoutMs = 20000
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(withBase(path), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`API ${res.status}: ${error}`);
    }
    return parseJsonSafe<T>(res);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(withBase(path), { method: "DELETE", headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
