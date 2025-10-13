require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const passport = require("passport");
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const redisClient = require("./src/config/redis");
const logger = require("./src/config/logger");
const apiRoutes = require("./src/api/v1/routes");
const errorHandler = require("./src/middleware/errorHandler");
const { setupSocket } = require("./src/socket/socketHandler");
const { startMetricsServer } = require("./src/config/metrics");

const app = express();
const server = http.createServer(app);

// Hubungkan ke Database
connectDB();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Passport Middleware
app.use(passport.initialize());
require("./src/config/passport")(passport);

// Routes
app.use("/api/v1", apiRoutes);

// Error Handler
app.use(errorHandler);

// Setup Socket.IO
setupSocket(server);

// Start Metrics Server
startMetricsServer();

const PORT = process.env.PORT || 3000;

const mainServer = server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Logika Graceful Shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  mainServer.close(() => {
    logger.info("HTTP server closed.");

    // Tutup koneksi MongoDB
    mongoose.connection.close(false, () => {
      logger.info("MongoDB connection closed.");

      // Tutup koneksi Redis
      if (redisClient.isOpen) {
        redisClient.quit();
        logger.info("Redis connection closed.");
      }

      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
