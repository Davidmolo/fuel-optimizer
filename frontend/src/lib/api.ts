import { getAuthSession } from "@/lib/auth-session";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data?: T;
};

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const session = typeof window !== "undefined" ? getAuthSession() : null;
  const authHeaders = session?.email ? { "X-User-Email": session.email } : {};

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
      ...options?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok) {
    return {
      success: false,
      message: body?.message || `Request failed (${response.status})`,
    };
  }

  return (body ?? { success: false, message: "Empty response from API" }) as ApiResponse<T>;
}
