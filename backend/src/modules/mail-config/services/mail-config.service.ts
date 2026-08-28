import nodemailer from "nodemailer";
import { env } from "../../../config/env";
import { HttpError } from "../../../utils/http-error";

export type EmailRuntimeConfig = {
  service: string;
  host: string;
  username: string;
  password: string;
  fromName: string;
};

function trimOrEmpty(value?: string) {
  return value?.trim() ?? "";
}

export function getEmailConfig(): EmailRuntimeConfig | null {
  const service = trimOrEmpty(env.MAIL_SERVICE);
  const host = trimOrEmpty(env.MAIL_HOST);
  const username = trimOrEmpty(env.MAIL_USERNAME);
  const password = env.MAIL_PASSWORD ?? "";
  const fromName = trimOrEmpty(env.MAIL_FROM_NAME);

  if (!service || !host || !username || !password || !fromName) {
    return null;
  }

  return { service, host, username, password, fromName };
}

export function requireEmailConfig(): EmailRuntimeConfig {
  const config = getEmailConfig();

  if (!config) {
    throw new HttpError(
      "Email is not configured. Set MAIL_SERVICE, MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD, and MAIL_FROM_NAME in the API environment.",
      503,
    );
  }

  return config;
}

export function createMailTransporter(config = requireEmailConfig()) {
  return nodemailer.createTransport({
    service: config.service,
    host: config.host,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

export function getEmailConfigForSettings() {
  const config = getEmailConfig();

  if (!config) {
    return {
      configured: false,
      source: "environment" as const,
      service: "",
      host: "",
      username: "",
      fromName: "",
      hasPassword: false,
    };
  }

  return {
    configured: true,
    source: "environment" as const,
    service: config.service,
    host: config.host,
    username: config.username,
    fromName: config.fromName,
    hasPassword: true,
  };
}

export async function verifyEmailTransport() {
  const config = requireEmailConfig();
  const transporter = createMailTransporter(config);
  await transporter.verify();

  return {
    configured: true,
    source: "environment" as const,
    service: config.service,
    host: config.host,
    username: config.username,
    fromName: config.fromName,
  };
}
