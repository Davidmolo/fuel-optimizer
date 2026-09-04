import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { hash } from "bcryptjs";
import mongoose from "mongoose";
import { HttpError } from "../../utils/http-error";
import { ADMIN_ROLE_NAME, USER_ROLE_NAME } from "../role/constants";
import { RoleModel } from "../role/models/role.model";
import { UserModel } from "../user/models/user.model";
import { InvitationModel } from "./models/invitation.model";
import {
  acceptInvitation,
  deleteAccount,
  getInvitationByToken,
  inviteAccount,
  listWorkspaceAccounts,
  resendInvitation,
  revokeInvitation,
  type AccountActor,
} from "./services/account.service";

const TEST_DB_URI = "mongodb://127.0.0.1:27017/fuel-optimizer-account-test";

async function ensureRole(name: string) {
  const role = await RoleModel.findOneAndUpdate(
    { name },
    { $setOnInsert: { name } },
    { upsert: true, returnDocument: "after" },
  ).lean();

  if (!role) {
    throw new Error(`Missing ${name} role`);
  }

  return role;
}

async function createUser(email: string, roleName: string) {
  const role = await ensureRole(roleName);
  const user = await UserModel.create({
    email,
    password: await hash("Password123!", 4),
    roleId: role._id,
  });

  return {
    id: String(user._id),
    email: user.email,
    roleId: String(user.roleId),
    role: roleName,
  } satisfies AccountActor;
}

describe("account invitation flow", () => {
  let lastToken = "";

  async function captureInvite(actor: AccountActor, email: string, role: "admin" | "user") {
    lastToken = "";
    return inviteAccount(actor, { email, role }, async (payload) => {
      lastToken = payload.token;
    });
  }

  before(async () => {
    await mongoose.connect(TEST_DB_URI);
  });

  beforeEach(async () => {
    lastToken = "";
    await Promise.all([
      UserModel.deleteMany({}),
      RoleModel.deleteMany({}),
      InvitationModel.deleteMany({}),
    ]);
    await ensureRole(ADMIN_ROLE_NAME);
    await ensureRole(USER_ROLE_NAME);
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("lets admin and user invite, then accepts the invite as a real account", async () => {
    const admin = await createUser("admin@example.com", ADMIN_ROLE_NAME);
    const member = await createUser("member@example.com", USER_ROLE_NAME);

    await captureInvite(admin, "new-admin@example.com", "admin");
    assert.match(lastToken, /^[a-f0-9]{64}$/);

    const preview = await getInvitationByToken(lastToken);
    assert.equal(preview.email, "new-admin@example.com");
    assert.equal(preview.role, "admin");

    const accepted = await acceptInvitation({ token: lastToken, password: "Welcome123!" });
    assert.equal(accepted.email, "new-admin@example.com");
    assert.equal(accepted.role, "admin");

    const created = await UserModel.findOne({ email: "new-admin@example.com" }).lean();
    assert.ok(created);

    await assert.rejects(
      () => inviteAccount(member, { email: "another-admin@example.com", role: "admin" }, async () => {}),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );

    await captureInvite(member, "new-user@example.com", "user");
    await acceptInvitation({ token: lastToken, password: "Welcome123!" });

    const listed = await listWorkspaceAccounts(admin);
    assert.equal(listed.currentUser.canInviteAdmin, true);
    assert.equal(listed.members.some((account) => account.email === "new-user@example.com" && account.role === "user"), true);
    assert.equal(listed.invitations.length, 0);
  });

  it("blocks a user from deleting an admin and lets an admin delete a user", async () => {
    const admin = await createUser("admin@example.com", ADMIN_ROLE_NAME);
    const member = await createUser("member@example.com", USER_ROLE_NAME);
    const otherUser = await createUser("other@example.com", USER_ROLE_NAME);

    await assert.rejects(
      () => deleteAccount(member, admin.id),
      (error: unknown) =>
        error instanceof HttpError &&
        error.statusCode === 403 &&
        error.message === "Users cannot remove admin accounts",
    );

    const removed = await deleteAccount(admin, otherUser.id);
    assert.equal(removed.email, "other@example.com");
    assert.equal(await UserModel.countDocuments({ email: "other@example.com" }), 0);

    const listed = await listWorkspaceAccounts(member);
    const adminRow = listed.members.find((account) => account.id === admin.id);
    assert.equal(adminRow?.canDelete, false);
    assert.equal(adminRow?.deleteBlockedReason, "Users cannot remove admin accounts");
  });

  it("revokes and resends pending invitations", async () => {
    const admin = await createUser("admin@example.com", ADMIN_ROLE_NAME);
    await captureInvite(admin, "pending@example.com", "user");
    const firstToken = lastToken;

    const listed = await listWorkspaceAccounts(admin);
    assert.equal(listed.invitations.length, 1);

    await resendInvitation(admin, listed.invitations[0].id, async (payload) => {
      lastToken = payload.token;
    });

    await assert.rejects(() => getInvitationByToken(firstToken), (error: unknown) => error instanceof HttpError);

    const preview = await getInvitationByToken(lastToken);
    assert.equal(preview.email, "pending@example.com");

    await revokeInvitation(admin, listed.invitations[0].id);
    await assert.rejects(() => getInvitationByToken(lastToken), (error: unknown) => error instanceof HttpError);
  });
});
