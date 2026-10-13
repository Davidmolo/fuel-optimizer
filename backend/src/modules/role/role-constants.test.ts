import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_ROLES,
  DISPATCHER_ROLE_NAME,
  isAccountRole,
  isAdminRole,
  isDispatcherRole,
  isSettingsAccessRole,
} from "./constants";

describe("role constants", () => {
  it("includes dispatcher in account roles", () => {
    assert.ok(ACCOUNT_ROLES.includes(DISPATCHER_ROLE_NAME));
    assert.equal(isAccountRole("dispatcher"), true);
    assert.equal(isAccountRole("guest"), false);
  });

  it("recognizes admin and dispatcher helpers", () => {
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("dispatcher"), false);
    assert.equal(isDispatcherRole("dispatcher"), true);
    assert.equal(isDispatcherRole("admin"), false);
  });

  it("limits settings access to admin until David approves changes", () => {
    assert.equal(isSettingsAccessRole("admin"), true);
    assert.equal(isSettingsAccessRole("dispatcher"), false);
    assert.equal(isSettingsAccessRole("user"), false);
  });
});
