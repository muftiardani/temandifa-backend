const { initTracing } = require("./src/config/tracing");
initTracing("api-gateway");

const cluster = require("cluster");
const os = require("os");

const config = require("./src/config/appConfig");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { createAdapter } = require("@socket.io/redis-adapter");

const connectDB = require("./src/config/db");
const { redisClient, connectRedis } = require("./src/config/redis");
const { logger, errorWithContext } = require("./src/config/logger");
const { startMetricsServer } = require("./src/config/metrics");
const { initializeSocket } = require("./src/socket/socketHandler");
const { initializeExpressApp, server } = require("./src/config/expressApp");
const appEmitter = require("./src/events/appEmitter");

const PORT = config.port;

const io = new Server(server, {
  cors: {
    origin: config.clientUrl,
    methods: ["GET", "POST"],
  },
});

const pubClient = redisClient.duplicate();
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

const startServer = async () => {
  try {
    if (cluster.worker) {
      logger.defaultMeta = {
        ...logger.defaultMeta,
        workerId: cluster.worker.id,
      };
    }

    await initializeExpressApp();
    logger.info("Express app initialized.");

    await connectDB();
    await connectRedis();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    await appEmitter.initialize();

    logger.info("Database, Redis (Cache, Adapter, EventBus) connected.");

    initializeSocket(io);
    logger.info("Socket.IO initialized with Redis Adapter.");

    startMetricsServer();

    const mainServer = server.listen(PORT, () => {
      logger.info(
        `Worker (PID: ${process.pid}) mulai. Server berjalan di ${config.nodeEnv} mode di port ${PORT}`
      );
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
          }

          if (pubClient.isOpen) await pubClient.quit();
          if (subClient.isOpen) await subClient.quit();

          await appEmitter.close();

          logger.info("All connections closed.");
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

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  logger.info(`Proses Primary (PID: ${process.pid}) berjalan.`);
  logger.info(`Membuat ${numCPUs} worker...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      `Worker (PID: ${worker.process.pid}) mati. Code: ${code}, Signal: ${signal}.`,
      {
        workerId: worker.id,
      }
    );
    logger.info("Membuat worker baru...");
    cluster.fork();
  });
} else {
  if (cluster.worker.id === 1) {
    logger.info(
      `Worker ${cluster.worker.id} (PID: ${process.pid}) is starting the notification receipt checker.`
    );
    setTimeout(() => {
      require("./src/api/v1/services/notificationService").startReceiptProcessing();
    }, 5000);
  }

  startServer();
}

module.exports = { app: require("./src/config/expressApp").app, server, io };
