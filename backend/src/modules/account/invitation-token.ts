import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function createInvitationToken() {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token.trim().toLowerCase()).digest("hex");
}

export function invitationTokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
