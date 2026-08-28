/**
 * Probe Relay fuel transactions API with varying date windows.
 * Usage: node scripts/probe-relay-transactions.mjs [account] [daysBack]
 *   account: blue_stallion | azfs (default: both)
 *   daysBack: lookback days for full-window test (default: 30)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const KEYS = {
  blue_stallion: process.env.RELAY_API_KEY_BLUE_STALLION,
  azfs: process.env.RELAY_API_KEY_AZFS,
};

const baseUrl = (process.env.RELAY_API_BASE_URL || "https://app.relaypayments.com/api/integrations").replace(
  /\/$/,
  "",
);
const txBaseUrl = baseUrl.endsWith("/integrations") ? baseUrl.replace(/\/integrations$/, "") : baseUrl;

function toIso(date) {
  return date.toISOString();
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function fetchTransactions(apiKey, dtstart, dtend) {
  const url = new URL(`${txBaseUrl}/fuel/transactions/`);
  url.searchParams.set("dtstart", dtstart);
  url.searchParams.set("dtend", dtend);

  const started = Date.now();
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: apiKey },
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
      dtstart,
      dtend,
    };
  }

  const elapsedMs = Date.now() - started;
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const items = Array.isArray(body) ? body : body?.results ?? body?.data ?? [];
  const message =
    body && typeof body === "object" && !Array.isArray(body)
      ? body.message || body.error || body.detail
      : undefined;

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    count: items.length,
    error: response.ok ? undefined : message || `HTTP ${response.status}`,
    dtstart,
    dtend,
  };
}

function buildChunks(dtend, lookbackDays, chunkDays) {
  const dtstart = addDays(dtend, -lookbackDays);
  const chunks = [];
  let cursor = new Date(dtstart);

  while (cursor < dtend) {
    const chunkEnd = addDays(cursor, chunkDays);
    const end = chunkEnd < dtend ? chunkEnd : dtend;
    chunks.push({ dtstart: toIso(cursor), dtend: toIso(end) });
    cursor = end;
  }

  return chunks;
}

async function probeAccount(account, apiKey, lookbackDays) {
  const dtend = new Date();
  const dtstart = addDays(dtend, -lookbackDays);

  console.log(`\n=== ${account} (lookback ${lookbackDays} days) ===`);

  // 1) Single day (most recent)
  const oneDayStart = addDays(dtend, -1);
  const oneDay = await fetchTransactions(apiKey, toIso(oneDayStart), toIso(dtend));
  console.log("1-day window:", JSON.stringify(oneDay));

  // 2) 3-day window
  const threeDayStart = addDays(dtend, -3);
  const threeDay = await fetchTransactions(apiKey, toIso(threeDayStart), toIso(dtend));
  console.log("3-day window:", JSON.stringify(threeDay));

  // 3) Full lookback single request
  const full = await fetchTransactions(apiKey, toIso(dtstart), toIso(dtend));
  console.log(`${lookbackDays}-day single request:`, JSON.stringify(full));

  // 4) Chunked 7-day requests
  const chunks = buildChunks(dtend, lookbackDays, 7);
  const chunkResults = [];
  let chunkedTotal = 0;
  let chunkedFailed = 0;

  for (const chunk of chunks) {
    const result = await fetchTransactions(apiKey, chunk.dtstart, chunk.dtend);
    chunkResults.push(result);
    if (result.ok) chunkedTotal += result.count;
    else chunkedFailed++;
  }

  console.log(
    `7-day chunks (${chunks.length} requests):`,
    JSON.stringify({
      chunkCount: chunks.length,
      succeeded: chunkResults.filter((r) => r.ok).length,
      failed: chunkedFailed,
      totalTransactions: chunkedTotal,
      chunks: chunkResults,
    }),
  );

  return { account, oneDay, threeDay, full, chunkResults, chunkedTotal };
}

async function main() {
  const accountArg = process.argv[2];
  const lookbackDays = Number(process.argv[3] || 30);

  const accounts =
    accountArg && KEYS[accountArg] ? [accountArg] : Object.keys(KEYS).filter((k) => KEYS[k]);

  if (accounts.length === 0) {
    console.error("No Relay API keys configured");
    process.exit(1);
  }

  for (const account of accounts) {
    await probeAccount(account, KEYS[account], lookbackDays);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
