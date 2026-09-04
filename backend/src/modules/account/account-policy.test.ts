import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canDeleteAccount, canInviteAsRole, canRevokeInvitation, describeDeleteBlock } from "./account-policy";

const admin = { id: "admin-1", role: "admin" };
const otherAdmin = { id: "admin-2", role: "admin" };
const user = { id: "user-1", role: "user" };
const otherUser = { id: "user-2", role: "user" };

describe("account invite policy", () => {
  it("lets both admin and user invite as user", () => {
    assert.equal(canInviteAsRole("admin", "user"), true);
    assert.equal(canInviteAsRole("user", "user"), true);
  });

  it("lets only admin invite as admin", () => {
    assert.equal(canInviteAsRole("admin", "admin"), true);
    assert.equal(canInviteAsRole("user", "admin"), false);
  });
});

describe("account delete policy", () => {
  it("blocks self-delete", () => {
    assert.equal(describeDeleteBlock({ actor: admin, target: admin, adminCount: 2 }), "You cannot remove your own account");
    assert.equal(canDeleteAccount({ actor: user, target: user, adminCount: 1 }), false);
  });

  it("blocks a user from deleting an admin", () => {
    assert.equal(
      describeDeleteBlock({ actor: user, target: admin, adminCount: 1 }),
      "Users cannot remove admin accounts",
    );
  });

  it("lets an admin delete any other account", () => {
    assert.equal(canDeleteAccount({ actor: admin, target: user, adminCount: 1 }), true);
    assert.equal(canDeleteAccount({ actor: admin, target: otherAdmin, adminCount: 2 }), true);
  });

  it("lets a user delete another user but not an admin", () => {
    assert.equal(canDeleteAccount({ actor: user, target: otherUser, adminCount: 1 }), true);
    assert.equal(canDeleteAccount({ actor: user, target: admin, adminCount: 1 }), false);
  });

  it("protects the last remaining admin", () => {
    assert.equal(
      describeDeleteBlock({ actor: admin, target: otherAdmin, adminCount: 1 }),
      "The last admin account cannot be removed",
    );
  });
});

describe("invitation revoke policy", () => {
  it("lets admins revoke any invite and users revoke their own", () => {
    assert.equal(canRevokeInvitation({ actor: admin, invitedById: user.id }), true);
    assert.equal(canRevokeInvitation({ actor: user, invitedById: user.id }), true);
    assert.equal(canRevokeInvitation({ actor: user, invitedById: admin.id }), false);
  });
});
