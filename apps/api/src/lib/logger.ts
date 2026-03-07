import pino from "pino";

/**
 * Shared logger for modules that don't have access to the Fastify request logger.
 * Uses the same log file as the Fastify server.
 */
const logger = pino(
  { level: process.env.LOG_LEVEL || "info" },
  pino.destination("./logs.log")
);

export default logger;
