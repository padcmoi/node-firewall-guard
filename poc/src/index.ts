import { createPocApp } from "./app.js";
import { POC_DRY_RUN, POC_IGNORE_IPS, POC_PORT } from "./config/env.js";
import { firewall } from "./services/firewall.service.js";

async function bootstrap() {
  await firewall.init();
  const app = createPocApp(firewall);

  const server = app.listen(POC_PORT, () => {
    console.info(`[POC] firewall running on port ${POC_PORT}`);
    console.info(`[POC] ignoreIps=${POC_IGNORE_IPS.join(",") || "none"}`);
    console.info(`[POC] dryRun=${POC_DRY_RUN}`);
  });

  const shutdown = () => {
    firewall.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void bootstrap();
