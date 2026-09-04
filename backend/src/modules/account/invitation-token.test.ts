import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInvitationToken, hashInvitationToken, invitationTokensMatch } from "./invitation-token";

describe("invitation tokens", () => {
  it("creates a 64-character hex token", () => {
    const token = createInvitationToken();
    assert.match(token, /^[a-f0-9]{64}$/);
  });

  it("hashes the same token consistently and distinguishes different tokens", () => {
    const token = createInvitationToken();
    const hashed = hashInvitationToken(token);

    assert.equal(hashed, hashInvitationToken(token));
    assert.equal(invitationTokensMatch(hashed, hashInvitationToken(token)), true);
    assert.notEqual(hashed, hashInvitationToken(createInvitationToken()));
  });
});
