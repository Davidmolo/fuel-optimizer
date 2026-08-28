import { SamsaraConfigModel } from "../models/samsara-config.model";

const DEFAULT_SAMSARA_CONFIG_KEY = "samsara_config";
const DEFAULT_STALE_MINUTES = 30;

export async function getSamsaraConfig() {
  return SamsaraConfigModel.findOne({ key: DEFAULT_SAMSARA_CONFIG_KEY }).lean();
}

export async function getSamsaraTelemetryStaleMs() {
  const config = await getSamsaraConfig();
  const minutes = config?.telemetryStaleMinutes ?? DEFAULT_STALE_MINUTES;
  return minutes * 60 * 1000;
}

export async function ensureSamsaraConfig(payload: {
  apiBaseUrl: string;
  apiToken: string;
  telemetryStaleMinutes: number;
}) {
  await SamsaraConfigModel.findOneAndUpdate(
    { key: DEFAULT_SAMSARA_CONFIG_KEY },
    {
      $set: {
        key: DEFAULT_SAMSARA_CONFIG_KEY,
        apiBaseUrl: payload.apiBaseUrl,
        apiToken: payload.apiToken,
        telemetryStaleMinutes: payload.telemetryStaleMinutes,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function ensureSamsaraConfigSeed(payload: {
  apiBaseUrl: string;
  apiToken: string;
  telemetryStaleMinutes: number;
}) {
  await SamsaraConfigModel.findOneAndUpdate(
    { key: DEFAULT_SAMSARA_CONFIG_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_SAMSARA_CONFIG_KEY,
        apiBaseUrl: payload.apiBaseUrl,
        apiToken: payload.apiToken,
        telemetryStaleMinutes: payload.telemetryStaleMinutes,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function getSamsaraConfigForSettings() {
  const config = await getSamsaraConfig();
  if (!config) {
    return null;
  }

  return {
    key: config.key,
    apiBaseUrl: config.apiBaseUrl,
    telemetryStaleMinutes: config.telemetryStaleMinutes,
    hasApiToken: Boolean(config.apiToken),
    updatedAt: config.updatedAt,
  };
}

export async function updateSamsaraConfig(payload: {
  apiBaseUrl: string;
  apiToken?: string;
  telemetryStaleMinutes: number;
}) {
  const existing = await SamsaraConfigModel.findOne({ key: DEFAULT_SAMSARA_CONFIG_KEY });

  if (!existing) {
    return null;
  }

  const updatePayload: Record<string, string | number> = {
    apiBaseUrl: payload.apiBaseUrl,
    telemetryStaleMinutes: payload.telemetryStaleMinutes,
  };

  if (payload.apiToken && payload.apiToken.trim().length > 0) {
    updatePayload.apiToken = payload.apiToken.trim();
  }

  const updated = await SamsaraConfigModel.findOneAndUpdate(
    { key: DEFAULT_SAMSARA_CONFIG_KEY },
    { $set: updatePayload },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return null;
  }

  return {
    key: updated.key,
    apiBaseUrl: updated.apiBaseUrl,
    telemetryStaleMinutes: updated.telemetryStaleMinutes,
    hasApiToken: Boolean(updated.apiToken),
    updatedAt: updated.updatedAt,
  };
}
