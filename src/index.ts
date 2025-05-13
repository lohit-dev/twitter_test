import express from "express";
import { logger } from "./utils/logger";
import { authRouter, statusRouter } from "./routes";

async function main() {
  logger.info("Starting Twitter Metrics Bot...");

  const PORT = process.env.PORT || 3000;
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(authRouter);
  app.use(statusRouter);

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(
      `Visit http://localhost:${PORT} to set up your Twitter metrics bot`,
    );
  });

  process.on("SIGINT", () => {
    logger.info("Server shutting down...");
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Application error:", error);
  process.exit(1);
});
