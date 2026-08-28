import { hash } from "bcryptjs";
import { ensureEmailConfig } from "../../mail-config/services/mail-config.service";
import { ensureRecommendationConfigSeed } from "../../recommendation-config/services/recommendation-config.service";
import { ensureSamsaraConfigSeed } from "../../samsara-config/services/samsara-config.service";
import { ensureTrimbleConfigSeed } from "../../trimble-config/services/trimble-config.service";
import { ensureTwilioConfigSeed } from "../../twilio-config/services/twilio-config.service";
import { RoleModel } from "../../role/models/role.model";
import { UserModel } from "../../user/models/user.model";

const ADMIN_ROLE_NAME = "admin";
const ADMIN_EMAIL = "maaz@azfsllc.com";
const ADMIN_PASSWORD = "T$@dmin123456";
const EMAIL_SERVICE = "gmail";
const EMAIL_HOST = "smtp.gmail.com";
const EMAIL_USERNAME = "hello@fuelcap.ai";
const EMAIL_PASSWORD = "lmys tfox lqwo zzzl";
const EMAIL_FROM_NAME = "Fuel Distribution System";
const SAMSARA_API_BASE_URL = "https://api.samsara.com";
const SAMSARA_API_TOKEN = "";
const SAMSARA_TELEMETRY_STALE_MINUTES = 30;

export async function ensureAdminUser() {
  await ensureEmailConfig({
    service: EMAIL_SERVICE,
    host: EMAIL_HOST,
    username: EMAIL_USERNAME,
    password: EMAIL_PASSWORD,
    fromName: EMAIL_FROM_NAME,
  });

  await ensureSamsaraConfigSeed({
    apiBaseUrl: SAMSARA_API_BASE_URL,
    apiToken: SAMSARA_API_TOKEN,
    telemetryStaleMinutes: SAMSARA_TELEMETRY_STALE_MINUTES,
  });

  await ensureTrimbleConfigSeed();

  await ensureRecommendationConfigSeed();

  await ensureTwilioConfigSeed();

  const adminRole = await RoleModel.findOneAndUpdate(
    { name: ADMIN_ROLE_NAME },
    { $setOnInsert: { name: ADMIN_ROLE_NAME } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  const existingAdmin = await UserModel.findOne({ email: ADMIN_EMAIL }).lean();

  if (!existingAdmin) {
    const hashedPassword = await hash(ADMIN_PASSWORD, 10);

    await UserModel.create({
      email: ADMIN_EMAIL,
      password: hashedPassword,
      roleId: adminRole._id,
    });
  }

  await UserModel.deleteMany({ email: { $ne: ADMIN_EMAIL } });
}
