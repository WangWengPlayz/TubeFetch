import app from "./app";
import { logger } from "./lib/logger";

// Only start the server if running directly (not in Vercel serverless)
// Vercel wraps the app and doesn't need app.listen()
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const rawPort = process.env["PORT"] || "3000";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });

  // Auto-restart every 24 hours to keep memory clean
  const MS_24H = 24 * 60 * 60 * 1000;
  setTimeout(() => {
    logger.info("24-hour scheduled restart — exiting cleanly");
    process.exit(0);
  }, MS_24H).unref();
}
