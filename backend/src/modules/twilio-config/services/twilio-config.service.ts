import { TwilioConfigModel } from "../models/twilio-config.model";

const DEFAULT_TWILIO_CONFIG_KEY = "twilio_config";

export async function getTwilioConfig() {
  return TwilioConfigModel.findOne({ key: DEFAULT_TWILIO_CONFIG_KEY }).lean();
}

export async function ensureTwilioConfig(payload: {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}) {
  await TwilioConfigModel.findOneAndUpdate(
    { key: DEFAULT_TWILIO_CONFIG_KEY },
    {
      $set: {
        key: DEFAULT_TWILIO_CONFIG_KEY,
        accountSid: payload.accountSid,
        authToken: payload.authToken,
        fromNumber: payload.fromNumber,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function ensureTwilioConfigSeed() {
  await TwilioConfigModel.findOneAndUpdate(
    { key: DEFAULT_TWILIO_CONFIG_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_TWILIO_CONFIG_KEY,
        accountSid: "",
        authToken: "",
        fromNumber: "",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function getTwilioConfigForSettings() {
  const config = await getTwilioConfig();
  if (!config) {
    return null;
  }

  return {
    key: config.key,
    accountSid: config.accountSid,
    fromNumber: config.fromNumber,
    hasAuthToken: Boolean(config.authToken),
    updatedAt: config.updatedAt,
  };
}

export async function updateTwilioConfig(payload: {
  accountSid: string;
  fromNumber: string;
  authToken?: string;
}) {
  const existing = await TwilioConfigModel.findOne({ key: DEFAULT_TWILIO_CONFIG_KEY });

  if (!existing) {
    return null;
  }

  const updatePayload: Record<string, string> = {
    accountSid: payload.accountSid,
    fromNumber: payload.fromNumber,
  };

  if (payload.authToken && payload.authToken.trim().length > 0) {
    updatePayload.authToken = payload.authToken.trim();
  }

  const updated = await TwilioConfigModel.findOneAndUpdate(
    { key: DEFAULT_TWILIO_CONFIG_KEY },
    { $set: updatePayload },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return null;
  }

  return {
    key: updated.key,
    accountSid: updated.accountSid,
    fromNumber: updated.fromNumber,
    hasAuthToken: Boolean(updated.authToken),
    updatedAt: updated.updatedAt,
  };
}
