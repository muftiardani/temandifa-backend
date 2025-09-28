require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const apiRoutes = require("./src/routes/apiRoutes");
const logger = require("./src/config/logger");
const errorHandler = require("./src/middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.get("/health", async (req, res) => {
  try {
    const services = [
      {
        name: "yolo-detector",
        url: `${process.env.DETECTOR_URL.replace("/detect", "")}/health`,
      },
      {
        name: "voice-transcriber",
        url: `${process.env.TRANSCRIBER_URL.replace("/transcribe", "")}/health`,
      },
    ];

    const healthStatus = {
      status: "OK",
      services: {},
    };

    const promises = services.map((service) =>
      axios.get(service.url, { timeout: 2000 })
    );
    const results = await Promise.allSettled(promises);

    results.forEach((result, index) => {
      const serviceName = services[index].name;
      if (result.status === "fulfilled" && result.value.status === 200) {
        healthStatus.services[serviceName] = "OK";
      } else {
        healthStatus.status = "ERROR";
        healthStatus.services[serviceName] = "FAIL";
        logger.error(`Health check failed for service: ${serviceName}`);
      }
    });

    const statusCode = healthStatus.status === "OK" ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error("Error during health check:", error);
    res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error during health check",
    });
  }
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server berjalan di port ${PORT}`);
});
