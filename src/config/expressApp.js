const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const YAML = require("yamljs");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const config = require("./appConfig");
const { logger, addUserToReq } = require("./logger");
const errorHandler = require("../middleware/errorHandler");
const apiV1Routes = require("../api/v1/routes");

const app = express();
const server = http.createServer(app);

const importDynamicModules = async () => {
  const addRequestIdModule = await import("express-request-id");
  const addRequestId = addRequestIdModule.default();
  app.use(addRequestId);
};

const setupMiddleware = () => {
  app.set("trust proxy", "loopback");
  app.use(cors({ origin: config.corsOrigin }));
  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  const generalLimiter = rateLimit({
    windowMs: config.rateLimit.generalWindowMs,
    max: config.rateLimit.generalMax,
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
    windowMs: config.rateLimit.authWindowMs,
    max: config.rateLimit.authMax,
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
};

const setupRoutesAndErrorHandling = () => {
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
};

const initializeExpressApp = async () => {
  await importDynamicModules();
  setupMiddleware();
  setupRateLimiting();
  setupRoutesAndErrorHandling();
  return { app, server };
};

module.exports = { initializeExpressApp, app, server };
