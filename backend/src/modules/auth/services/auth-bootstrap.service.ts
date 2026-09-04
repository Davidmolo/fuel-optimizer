import { hash } from "bcryptjs";
import { ensureRecommendationConfigSeed } from "../../recommendation-config/services/recommendation-config.service";
import { ensureTwilioConfigSeed } from "../../twilio-config/services/twilio-config.service";
import { ADMIN_ROLE_NAME, USER_ROLE_NAME } from "../../role/constants";
import { RoleModel } from "../../role/models/role.model";
import { UserModel } from "../../user/models/user.model";

const ADMIN_EMAIL = "maaz@azfsllc.com";
const ADMIN_PASSWORD = "T$@dmin123456";

async function ensureRole(name: string) {
  const role = await RoleModel.findOneAndUpdate(
    { name },
    { $setOnInsert: { name } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  if (!role) {
    throw new Error(`Failed to seed the ${name} role`);
  }

  return role;
}

export async function ensureAdminUser() {
  await ensureRecommendationConfigSeed();
  await ensureTwilioConfigSeed();

  const adminRole = await ensureRole(ADMIN_ROLE_NAME);
  await ensureRole(USER_ROLE_NAME);

  const existingAdmin = await UserModel.findOne({ email: ADMIN_EMAIL }).lean();

  if (existingAdmin) {
    return;
  }

  const hashedPassword = await hash(ADMIN_PASSWORD, 10);

  await UserModel.create({
    email: ADMIN_EMAIL,
    password: hashedPassword,
    roleId: adminRole._id,
  });
}
