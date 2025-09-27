require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const promClient = require("prom-client");
const apiRoutes = require("./src/routes/apiRoutes");
const logger = require("./src/config/logger");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit",
});
app.use(limiter);

app.use("/api", apiRoutes);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server berjalan di port ${PORT}`);
});
