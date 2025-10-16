const express = require("express");
const promClient = require("prom-client");
const logger = require("./logger");

const app = express();
const PORT = process.env.METRICS_PORT || 9100;

promClient.collectDefaultMetrics();

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

const startMetricsServer = () => {
  app.listen(PORT, () => {
    logger.info(`Metrics server berjalan di http://localhost:${PORT}`);
  });
};

module.exports = { startMetricsServer };
