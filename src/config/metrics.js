const express = require("express");
const promClient = require("prom-client");
const { logger } = require("./logger");
const config = require("./appConfig");

const app = express();
const PORT = config.metricsPort;

promClient.collectDefaultMetrics();

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (ex) {
    if (logger && typeof logger.error === "function") {
      logger.error("Error serving metrics:", {
        error: ex.message,
        stack: ex.stack,
      });
    } else {
      console.error("Error serving metrics (logger not available):", ex);
    }
    res.status(500).end("Internal Server Error retrieving metrics");
  }
});

const startMetricsServer = () => {
  const metricsServer = require("http").createServer(app);

  metricsServer.listen(PORT, () => {
    if (logger && typeof logger.info === "function") {
      logger.info(
        `Metrics server berjalan di http://localhost:${PORT}/metrics`
      );
    } else {
      console.log(
        `Metrics server berjalan di http://localhost:${PORT}/metrics (logger not available)`
      );
    }
  });

  metricsServer.on("error", (err) => {
    if (logger && typeof logger.error === "function") {
      logger.error(`Metrics server error: ${err.message}`);
    } else {
      console.error(
        `Metrics server error (logger not available): ${err.message}`
      );
    }
  });
};

module.exports = {
  startMetricsServer,
  client: promClient,
};
