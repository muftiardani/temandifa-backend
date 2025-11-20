const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redisClient } = require("./redis");

const mongoSanitize = require("express-mongo-sanitize");
const mongoose = require("mongoose");

const config = require("./appConfig");
const { logger, addUserToReq } = require("./logger");
const errorHandler = require("../middleware/errorHandler");
const apiV1Routes = require("../api/v1/routes");

const { getOpenApiDocumentation } = require("./swaggerConfig");

const addRequestId = require("express-request-id");

const app = express();
const server = http.createServer(app);

const setupMiddleware = () => {
  app.set("trust proxy", "loopback");
  app.use(cors({ origin: config.corsOrigin }));
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    mongoSanitize({
      onSanitize: ({ req, key }) => {
        logger.warn(`Potential NoSQL Injection detected in ${key}`, {
          ip: req.ip,
        });
      },
    })
  );

  app.use(addRequestId());

  app.use(
    morgan(config.isProduction ? "combined" : "dev", {
      stream: { write: (message) => logger.info(message.trim()) },
      skip: (req, res) => req.path === "/metrics" || req.path === "/health",
    })
  );

  app.use(addUserToReq);
};

const setupRateLimiting = () => {
  const customKeyGenerator = (req) => ipKeyGenerator(req);

  const redisStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  });

  const generalLimiter = rateLimit({
    windowMs: config.rateLimit.generalWindowMs,
    max: config.rateLimit.generalMax,
    store: redisStore,
    message: {
      message: "Terlalu banyak request dari IP ini, silakan coba lagi nanti.",
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
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMax,
    store: redisStore,
    message: {
      message: "Terlalu banyak percobaan otentikasi, silakan coba lagi nanti.",
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
};

const setupRoutesAndErrorHandling = () => {
  app.use("/api/v1", apiV1Routes);

  try {
    const swaggerDocs = getOpenApiDocumentation();
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
    logger.info("Swagger docs (generated from Zod) available at /api-docs");
  } catch (error) {
    logger.error("Failed to generate OpenAPI/Swagger specs from Zod:", error);
  }

  app.get("/health", async (req, res) => {
    const mongoStatus = mongoose.connection.readyState === 1 ? "UP" : "DOWN";
    const redisStatus = redisClient.isOpen ? "UP" : "DOWN";

    const isHealthy = mongoStatus === "UP" && redisStatus === "UP";
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: isHealthy ? "UP" : "DOWN",
      timestamp: new Date(),
      services: {
        database: mongoStatus,
        cache: redisStatus,
      },
    });
  });

  app.use(errorHandler);
};

const initializeExpressApp = async () => {
  setupMiddleware();
  setupRateLimiting();
  setupRoutesAndErrorHandling();
  return { app, server };
};

module.exports = { initializeExpressApp, app, server };
