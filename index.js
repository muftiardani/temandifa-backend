require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const promBundle = require("express-prom-bundle");
const errorHandler = require("./src/middleware/errorHandler");
const logger = require("./src/config/logger");

const apiV1Routes = require("./src/api/v1/routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: {
    collectDefaultMetrics: {},
  },
});
app.use(metricsMiddleware);

app.use("/api/v1", apiV1Routes);

app.get("/health", (req, res) => {
  res.status(200).send("API Gateway is healthy and running.");
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(
    `API Gateway berjalan di port ${PORT}, siap menerima permintaan untuk /api/v1`
  );
});
