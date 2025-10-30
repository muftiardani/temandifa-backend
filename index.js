require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const YAML = require("yamljs");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const connectDB = require("./src/config/db");
const { redisClient, connectRedis } = require("./src/config/redis");
const {
  logger,
  addUserToReq,
  errorWithContext,
} = require("./src/config/logger");
const { startMetricsServer } = require("./src/config/metrics");

const errorHandler = require("./src/middleware/errorHandler");

const apiV1Routes = require("./src/api/v1/routes");
const { initializeSocket } = require("./src/socket/socketHandler");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
  },
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    const addRequestIdModule = await import("express-request-id");
    const addRequestId = addRequestIdModule.default();

    app.set("trust proxy", "loopback");
    app.use(addRequestId);
    app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(
      morgan(process.env.NODE_ENV === "production" ? "combined" : "dev", {
        stream: { write: (message) => logger.info(message.trim()) },
        skip: (req, res) => req.path === "/metrics" || req.path === "/health",
      })
    );

    const customKeyGenerator = (req) => {
      const ip = ipKeyGenerator(req);
      return ip;
    };

    const generalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        message:
          "Terlalu banyak request dari IP ini, silakan coba lagi setelah 15 menit",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: customKeyGenerator,
      handler: (req, res, next, options) => {
        logger.warn(
          `Rate limit exceeded for IP ${options.keyGenerator(req)} on ${
            req.method
          } ${req.originalUrl}`
        );
        res.status(options.statusCode).send(options.message);
      },
    });

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: {
        message:
          "Terlalu banyak percobaan otentikasi dari IP ini, silakan coba lagi setelah 15 menit",
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: customKeyGenerator,
      handler: (req, res, next, options) => {
        logger.warn(
          `Auth rate limit exceeded for IP ${options.keyGenerator(req)} on ${
            req.method
          } ${req.originalUrl}`
        );
        res.status(options.statusCode).send(options.message);
      },
    });

    app.use("/api", generalLimiter);
    app.use("/api/v1/auth/login", authLimiter);
    app.use("/api/v1/auth/register", authLimiter);
    app.use("/api/v1/auth/google/mobile", authLimiter);
    app.use("/api/v1/auth/forgotpassword", authLimiter);
    app.use("/api/v1/auth/resetpassword/:token", authLimiter);
    app.use("/api/v1/auth/refresh-token", authLimiter);
    app.use(addUserToReq);
    app.use("/api/v1", apiV1Routes);

    try {
      const swaggerOptions = {
        definition: YAML.load("./src/docs/openapi.yaml"),
        apis: ["./src/docs/paths/**/*.yaml"],
      };
      const swaggerDocs = swaggerJsdoc(swaggerOptions);
      app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
      logger.info("Swagger docs (combined) available at /api-docs");
    } catch (yamlError) {
      logger.error("Failed to load or parse OpenAPI/Swagger specs:", yamlError);
    }

    app.get("/health", (req, res) => res.status(200).send("OK"));

    app.use(errorHandler);

    if (typeof initializeSocket !== "function") {
      logger.error(
        "FATAL: initializeSocket is not a function. Check exports in src/socket/socketHandler.js"
      );
      process.exit(1);
    }
    initializeSocket(io);
    logger.info("Socket.IO initialized.");

    startMetricsServer();

    const mainServer = server.listen(PORT, () => {
      logger.info(
        `Server running in ${
          process.env.NODE_ENV || "development"
        } mode on port ${PORT}`
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
      gracefulShutdown("unhandledRejection");
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

module.exports = { app, server, io };
