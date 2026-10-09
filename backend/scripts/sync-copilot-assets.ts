import { connectDatabase } from "../src/config/database";
import { syncCopilotAssetsFromExport } from "../src/modules/fleet/services/copilot-assets-sync.service";
import mongoose from "mongoose";

async function main() {
  await connectDatabase();
  const result = await syncCopilotAssetsFromExport();
  console.log(
    JSON.stringify(
      {
        exportCount: result.exportCount,
        matchedCount: result.matchedCount,
        updatedCount: result.updatedCount,
        unmatchedCount: result.unmatched.length,
        skippedCount: result.skipped.length,
        unmatched: result.unmatched,
        matchedSample: result.matched.slice(0, 5),
      },
      null,
      2,
    ),
  );
  await mongoose.disconnect();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
