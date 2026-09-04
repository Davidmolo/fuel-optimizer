import { getAuthSession } from "@/lib/auth-session";

export function getApiBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");

  if (typeof window === "undefined") {
    return configured;
  }

  if (!configured) {
    return "";
  }

  try {
    const url = new URL(configured, window.location.origin);
    if (url.hostname === window.location.hostname) {
      return "";
    }

    if (window.location.protocol === "https:" && url.protocol === "http:") {
      url.protocol = "https:";
      return url.origin;
    }

    return url.origin;
  } catch {
    return configured;
  }
}

export function apiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const session = typeof window !== "undefined" ? getAuthSession() : null;
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (session?.email) {
    headers.set("X-User-Email", session.email);
  }

  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers,
    });

    const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok) {
      return {
        success: false,
        message: body?.message || `Request failed (${response.status})`,
      };
    }

    return (body ?? { success: false, message: "Empty response from API" }) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      message: "Unable to reach the API. Check that the backend is running.",
    };
  }
}
