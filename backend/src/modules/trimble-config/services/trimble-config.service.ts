import { TrimbleConfigModel } from "../models/trimble-config.model";

const DEFAULT_TRIMBLE_CONFIG_KEY = "trimble_config";
export const DEFAULT_TRIMBLE_API_BASE_URL = "https://pcmiler.alk.com/apis/rest/v1.0/Service.svc";

/** Short NA truck route used only to verify the API key. */
const CONNECTION_TEST_STOPS = "-74.599412,40.361189;-74.622822,40.340184";

export type TrimbleConnectionTestResult = {
  ok: boolean;
  status: "connected" | "not_configured" | "failed";
  message: string;
  distanceMiles?: number;
  durationMinutes?: number;
};

export async function getTrimbleConfig() {
  return TrimbleConfigModel.findOne({ key: DEFAULT_TRIMBLE_CONFIG_KEY }).lean();
}

export async function ensureTrimbleConfigSeed(payload?: {
  apiBaseUrl?: string;
  apiKey?: string;
}) {
  await TrimbleConfigModel.findOneAndUpdate(
    { key: DEFAULT_TRIMBLE_CONFIG_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_TRIMBLE_CONFIG_KEY,
        apiBaseUrl: payload?.apiBaseUrl?.trim() || DEFAULT_TRIMBLE_API_BASE_URL,
        apiKey: payload?.apiKey?.trim() || "",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function getTrimbleConfigForSettings() {
  const config = await getTrimbleConfig();
  if (!config) {
    return null;
  }

  return {
    key: config.key,
    apiBaseUrl: config.apiBaseUrl,
    hasApiKey: Boolean(config.apiKey?.trim()),
    updatedAt: config.updatedAt,
  };
}

export async function updateTrimbleConfig(payload: {
  apiBaseUrl: string;
  apiKey?: string;
}) {
  const existing = await TrimbleConfigModel.findOne({ key: DEFAULT_TRIMBLE_CONFIG_KEY });

  if (!existing) {
    return null;
  }

  const updatePayload: Record<string, string> = {
    apiBaseUrl: payload.apiBaseUrl.trim(),
  };

  if (payload.apiKey && payload.apiKey.trim().length > 0) {
    updatePayload.apiKey = payload.apiKey.trim();
  }

  const updated = await TrimbleConfigModel.findOneAndUpdate(
    { key: DEFAULT_TRIMBLE_CONFIG_KEY },
    { $set: updatePayload },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return null;
  }

  return {
    key: updated.key,
    apiBaseUrl: updated.apiBaseUrl,
    hasApiKey: Boolean(updated.apiKey?.trim()),
    updatedAt: updated.updatedAt,
  };
}

export async function testTrimbleConnection(options?: {
  apiBaseUrl?: string;
  apiKey?: string;
}): Promise<TrimbleConnectionTestResult> {
  const saved = await getTrimbleConfig();
  const apiKey = options?.apiKey?.trim() || saved?.apiKey?.trim() || "";
  const apiBaseUrl = (
    options?.apiBaseUrl?.trim() ||
    saved?.apiBaseUrl?.trim() ||
    DEFAULT_TRIMBLE_API_BASE_URL
  ).replace(/\/+$/, "");

  if (!apiKey) {
    return {
      ok: false,
      status: "not_configured",
      message: "No Trimble API key saved. Enter a key and save, or test with a key entered above.",
    };
  }

  try {
    const url = new URL(`${apiBaseUrl}/route/routePath`);
    url.searchParams.set("stops", CONNECTION_TEST_STOPS);
    url.searchParams.set("vehType", "0");
    url.searchParams.set("routeType", "0");
    url.searchParams.set("hwyOnly", "false");
    url.searchParams.set("distUnits", "0");
    url.searchParams.set("region", "4");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const detail =
        response.status === 401 || response.status === 403
          ? "API key was rejected by Trimble."
          : `Trimble returned HTTP ${response.status}.`;

      return {
        ok: false,
        status: "failed",
        message: detail,
      };
    }

    const body = (await response.json().catch(() => null)) as {
      TDistance?: number;
      TMinutes?: number;
      geometry?: { coordinates?: unknown[] };
    } | null;

    const hasGeometry = Boolean(body?.geometry?.coordinates?.length);
    if (!hasGeometry) {
      return {
        ok: false,
        status: "failed",
        message: "Trimble responded but did not return a usable route path.",
      };
    }

    const distanceMiles = Number.isFinite(body?.TDistance)
      ? Math.round(Number(body?.TDistance) * 10) / 10
      : undefined;
    const durationMinutes = Number.isFinite(body?.TMinutes)
      ? Math.round(Number(body?.TMinutes) * 10) / 10
      : undefined;

    return {
      ok: true,
      status: "connected",
      message: "Connected to Trimble Maps. Truck route path API is working.",
      distanceMiles,
      durationMinutes,
    };
  } catch {
    return {
      ok: false,
      status: "failed",
      message: "Could not reach Trimble. Check the API base URL and network access.",
    };
  }
}
