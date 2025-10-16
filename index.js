require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
// const swaggerUi = require("swagger-ui-express");
// const swaggerJsdoc = require("swagger-jsdoc");
const connectDB = require("./src/config/db");
const { redisClient, connectRedis } = require("./src/config/redis");
const logger = require("./src/config/logger");
const apiRoutes = require("./src/api/v1/routes");
const { errorHandler } = require("./src/middleware/errorHandler");
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

    // Konfigurasi Swagger
    // const swaggerOptions = {
    //   swaggerDefinition: {
    //     openapi: "3.0.0",
    //     info: {
    //       title: "TemanDifa API",
    //       version: "1.0.0",
    //       description: "API Documentation for the TemanDifa application",
    //     },
    //     servers: [{ url: `http://localhost:${PORT}/api/v1` }],
    //     components: {
    //       securitySchemes: {
    //         bearerAuth: {
    //           type: "http",
    //           scheme: "bearer",
    //           bearerFormat: "JWT",
    //         },
    //       },
    //     },
    //     security: [{ bearerAuth: [] }],
    //   },
    //   apis: ["./src/api/v1/routes/*.js"],
    // };
    // const swaggerDocs = swaggerJsdoc(swaggerOptions);

    // Rute API
    app.use("/api/v1", apiRoutes);

    // Rute Dokumentasi API
    // app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

    // Error Handler
    app.use(errorHandler);

    // Setup Socket.IO
    initializeSocket(io);

    // Start Metrics Server
    startMetricsServer();

    const mainServer = server.listen(PORT, () => {
      logger.info(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
    });

    // Logika Graceful Shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      mainServer.close(() => {
        logger.info("HTTP server closed.");
        mongoose.connection.close(false).then(() => {
          logger.info("MongoDB connection closed.");
          if (redisClient.isOpen) {
            redisClient.quit().then(() => {
              logger.info("Redis connection closed.");
              process.exit(0);
            });
          } else {
            process.exit(0);
          }
        });
      });
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

module.exports = { app, server };
