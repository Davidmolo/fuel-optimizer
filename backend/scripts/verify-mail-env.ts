import { getEmailConfigForSettings, verifyEmailTransport } from "../src/modules/mail-config/services/mail-config.service";

async function main() {
  const settings = getEmailConfigForSettings();

  if (!settings.configured) {
    console.error("mail_not_configured");
    process.exit(1);
  }

  console.log("env_loaded");
  await verifyEmailTransport();
  console.log("smtp_ok");
}

void main().catch((error) => {
  console.error("smtp_failed");
  process.exitCode = 1;
  throw error;
});
