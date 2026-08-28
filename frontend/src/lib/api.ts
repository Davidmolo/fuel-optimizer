import { getAuthSession } from "@/lib/auth-session";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
    const response = await fetch(`${apiBaseUrl}${path}`, {
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
