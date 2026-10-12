import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRetryableRelayStatus, relayRetryDelayMs } from "./relay.client";

describe("relay retry behavior", () => {
  it("retries rate limits and server errors but not client errors", () => {
    assert.equal(isRetryableRelayStatus(429), true);
    assert.equal(isRetryableRelayStatus(500), true);
    assert.equal(isRetryableRelayStatus(502), true);
    assert.equal(isRetryableRelayStatus(503), true);
    assert.equal(isRetryableRelayStatus(400), false);
    assert.equal(isRetryableRelayStatus(401), false);
    assert.equal(isRetryableRelayStatus(404), false);
  });

  it("backs off exponentially and honors Retry-After", () => {
    assert.equal(relayRetryDelayMs(0), 1000);
    assert.equal(relayRetryDelayMs(1), 2000);
    assert.equal(relayRetryDelayMs(2), 4000);
    assert.equal(relayRetryDelayMs(0, "3"), 3000);
    assert.equal(relayRetryDelayMs(4, "600"), 30_000);
  });
});
