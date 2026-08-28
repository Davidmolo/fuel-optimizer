import { hash } from "bcryptjs";
import { ensureRecommendationConfigSeed } from "../../recommendation-config/services/recommendation-config.service";
import { ensureTwilioConfigSeed } from "../../twilio-config/services/twilio-config.service";
import { RoleModel } from "../../role/models/role.model";
import { UserModel } from "../../user/models/user.model";

const ADMIN_ROLE_NAME = "admin";
const ADMIN_EMAIL = "maaz@azfsllc.com";
const ADMIN_PASSWORD = "T$@dmin123456";

export async function ensureAdminUser() {
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
