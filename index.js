require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const apiRoutes = require("./src/routes/apiRoutes");
const logger = require("./src/config/logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiter: Batasi setiap IP hingga 100 permintaan per 15 menit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // maks 100 permintaan per IP
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit",
});

app.use(limiter);

// Routes
app.use("/api", apiRoutes);

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  logger.info(`Server berjalan di port ${PORT}`);
});
