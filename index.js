const config = require("./src/config/appConfig");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const connectDB = require("./src/config/db");
const { redisClient, connectRedis } = require("./src/config/redis");
const { logger, errorWithContext } = require("./src/config/logger");
const { startMetricsServer } = require("./src/config/metrics");
const { initializeSocket } = require("./src/socket/socketHandler");
const { initializeExpressApp, server } = require("./src/config/expressApp");

const PORT = config.port;

const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
  },
});

const startServer = async () => {
  try {
    await initializeExpressApp();
    logger.info("Express app initialized.");

    await connectDB();
    await connectRedis();
    logger.info("Database and Redis connected.");

    initializeSocket(io);
    logger.info("Socket.IO initialized.");

    startMetricsServer();

    const mainServer = server.listen(PORT, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      mainServer.close(async () => {
        logger.info("HTTP server closed.");
        try {
          await mongoose.connection.close(false);
          logger.info("MongoDB connection closed.");
          if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
            logger.info("Redis connection closed.");
          } else {
            logger.info("Redis connection already closed or not initialized.");
          }
          logger.info("Graceful shutdown complete.");
          process.exit(0);
        } catch (err) {
          errorWithContext(
            "Error during graceful shutdown connections close:",
            err,
            null
          );
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.warn(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (reason, promise) => {
      errorWithContext(
        "Unhandled Rejection at:",
        reason instanceof Error ? reason : new Error(String(reason)),
        null,
        { promise }
      );
    });

    process.on("uncaughtException", (error) => {
      errorWithContext("Uncaught Exception thrown:", error, null);
      gracefulShutdown("uncaughtException");
      setTimeout(() => process.exit(1), 2000);
    });
  } catch (err) {
    console.error("FATAL: Failed to start server:", err);
    if (logger && typeof logger.error === "function") {
      logger.error("Failed to start server:", {
        error: err.message,
        stack: err.stack,
      });
    }
    process.exit(1);
  }
};

startServer();

module.exports = { app: require("./src/config/expressApp").app, server, io };
