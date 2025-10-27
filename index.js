require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const connectDB = require("./src/config/db");
const { redisClient, connectRedis } = require("./src/config/redis");
const logger = require("./src/config/logger");
const apiRoutes = require("./src/api/v1/routes");
const errorHandler = require("./src/middleware/errorHandler");
const { initializeSocket } = require("./src/socket/socketHandler");
const { startMetricsServer } = require("./src/config/metrics");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    const addRequestIdModule = await import("express-request-id");
    const addRequestId = addRequestIdModule.default();

    // Middleware
    app.use(addRequestId);
    app.use(cors());
    app.use(helmet());
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    const swaggerOptions = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: "TemanDifa API",
          version: "1.0.0",
          description: "API Documentation for the TemanDifa application",
        },
        servers: [{ url: `/api/v1` }],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      apis: ["./src/docs/openapi.yaml", "./src/docs/paths/**/*.yaml"],
    };
    const swaggerDocs = swaggerJsdoc(swaggerOptions);

    // Rute API Utama
    app.use("/api/v1", apiRoutes);

    // Rute Dokumentasi API Swagger
    app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

    // Error Handler
    app.use(errorHandler);

    // Setup Socket.IO
    initializeSocket(io);

    // Start Metrics Server
    startMetricsServer();

    // Mulai Server Utama
    const mainServer = server.listen(PORT, () => {
      logger.info(
        `Server running in ${
          process.env.NODE_ENV || "development"
        } mode on port ${PORT}`
      );
    });

    // Logika Graceful Shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      mainServer.close(() => {
        logger.info("HTTP server closed.");
        mongoose.connection
          .close(false)
          .then(() => {
            logger.info("MongoDB connection closed.");
            if (redisClient && redisClient.isOpen) {
              redisClient
                .quit()
                .then(() => {
                  logger.info("Redis connection closed.");
                  process.exit(0);
                })
                .catch((err) => {
                  logger.error("Error closing Redis connection:", err);
                  process.exit(1);
                });
            } else {
              logger.info(
                "Redis connection already closed or not initialized."
              );
              process.exit(0);
            }
          })
          .catch((err) => {
            logger.error("Error closing MongoDB connection:", err);
            process.exit(1);
          });
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
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

// Panggil fungsi untuk memulai server
startServer();

// Ekspor app dan server
module.exports = { app, server };
