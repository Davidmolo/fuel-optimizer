import { MailConfigModel } from "../models/mail-config.model";

const DEFAULT_MAIL_CONFIG_KEY = "email_config";

export async function getEmailConfig() {
  return MailConfigModel.findOne({ key: DEFAULT_MAIL_CONFIG_KEY }).lean();
}

export async function ensureEmailConfig(payload: {
  service: string;
  host: string;
  username: string;
  password: string;
  fromName: string;
}) {
  await MailConfigModel.findOneAndUpdate(
    { key: DEFAULT_MAIL_CONFIG_KEY },
    {
      $set: {
        key: DEFAULT_MAIL_CONFIG_KEY,
        service: payload.service,
        host: payload.host,
        username: payload.username,
        password: payload.password,
        fromName: payload.fromName,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
}

export async function getEmailConfigForSettings() {
  const config = await getEmailConfig();
  if (!config) {
    return null;
  }

  return {
    key: config.key,
    service: config.service,
    host: config.host,
    username: config.username,
    fromName: config.fromName,
    hasPassword: Boolean(config.password),
    updatedAt: config.updatedAt,
  };
}

export async function updateEmailConfig(payload: {
  service: string;
  host: string;
  username: string;
  password?: string;
  fromName: string;
}) {
  const existing = await MailConfigModel.findOne({ key: DEFAULT_MAIL_CONFIG_KEY });

  if (!existing) {
    return null;
  }

  const updatePayload: Record<string, string> = {
    service: payload.service,
    host: payload.host,
    username: payload.username,
    fromName: payload.fromName,
  };

  if (payload.password && payload.password.trim().length > 0) {
    updatePayload.password = payload.password.trim();
  }

  const updated = await MailConfigModel.findOneAndUpdate(
    { key: DEFAULT_MAIL_CONFIG_KEY },
    { $set: updatePayload },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    return null;
  }

  return {
    key: updated.key,
    service: updated.service,
    host: updated.host,
    username: updated.username,
    fromName: updated.fromName,
    hasPassword: Boolean(updated.password),
    updatedAt: updated.updatedAt,
  };
}
