import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SETTINGS_ACCESS_DENIED_MESSAGE, settingsAccessDeniedMessage } from "./require-admin";

describe("requireAdmin settings gate", () => {
  it("allows admin", () => {
    assert.equal(settingsAccessDeniedMessage("admin"), null);
  });

  it("returns 403 message for dispatcher and other non-admin roles", () => {
    assert.equal(settingsAccessDeniedMessage("dispatcher"), SETTINGS_ACCESS_DENIED_MESSAGE);
    assert.equal(settingsAccessDeniedMessage("user"), SETTINGS_ACCESS_DENIED_MESSAGE);
    assert.equal(settingsAccessDeniedMessage(""), SETTINGS_ACCESS_DENIED_MESSAGE);
    assert.equal(settingsAccessDeniedMessage(null), SETTINGS_ACCESS_DENIED_MESSAGE);
  });
});
