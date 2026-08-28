import app from "./app";
import { connectDatabase } from "./config/database";
import { env } from "./config/env";
import { ensureAdminUser } from "./modules/auth/services/auth-bootstrap.service";
import { ensureContractSeed } from "./modules/contract/services/contract-bootstrap.service";
import { syncMerchantContractsFromStations } from "./modules/contract/services/contract-merchant-sync.service";

async function bootstrap() {
  try {
    await connectDatabase();
    await ensureAdminUser();
    await ensureContractSeed();
    await syncMerchantContractsFromStations();
    app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

void bootstrap();
