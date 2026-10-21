import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { startTablet999AutomationWatcher, stopTablet999AutomationWatcher } from "./modules/copilot-lab/copilot-lab-automation.watcher";
import { startJobScheduler, stopJobScheduler } from "./modules/jobs/jobs.service";

async function bootstrap() {
  try {
    if (!env.SYNC_SCHEDULER_ENABLED) {
      throw new Error("Worker requires SYNC_SCHEDULER_ENABLED=true");
    }

    await connectDatabase();
    startJobScheduler();
    startTablet999AutomationWatcher();
    console.log("Fuel optimizer worker started");

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down worker`);
      stopTablet999AutomationWatcher();
      await stopJobScheduler();
      process.exit(0);
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
    console.error("Failed to start worker", error);
    process.exit(1);
  }
}

void bootstrap();
