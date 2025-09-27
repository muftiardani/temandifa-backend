const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  logger.error("Terjadi error:", {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    url: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.status || 500;
  const message = err.message || "Terjadi kesalahan internal pada server";

  res.status(statusCode).json({
    error: message,
  });
};

module.exports = errorHandler;
