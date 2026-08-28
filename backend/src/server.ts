import app from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { ensureAdminUser } from "./modules/auth/services/auth-bootstrap.service";
import { ensureContractSeed } from "./modules/contract/services/contract-bootstrap.service";
import { syncMerchantContractsFromStations } from "./modules/contract/services/contract-merchant-sync.service";
import { startJobScheduler, stopJobScheduler } from "./modules/jobs/jobs.service";

async function bootstrap() {
  try {
    await connectDatabase();
    await ensureAdminUser();
    await ensureContractSeed();
    await syncMerchantContractsFromStations();
    const server = app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
      startJobScheduler();
    });

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down`);
      await stopJobScheduler();
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => {
        process.exit(1);
      }, 15_000).unref();
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled promise rejection", reason);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

void bootstrap();
