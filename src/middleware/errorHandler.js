const { errorWithContext } = require("../config/logger");
const config = require("../config/appConfig");

const errorHandler = (err, req, res, next) => {
  let statusCode =
    err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  let message = err.message || "Terjadi kesalahan pada server";

  errorWithContext("Request Error:", err, req);

  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 404;
    message = "Resource tidak ditemukan (ID tidak valid)";
  } else if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    message = `Nilai duplikat untuk kolom '${field}': '${value}'. Harap gunakan nilai lain.`;
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  } else if (err.name === "ZodError") {
    statusCode = 400;
    message = err.errors
      .map((e) => `${e.path.join(".") || "input"}: ${e.message}`)
      .join("; ");
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Token tidak valid, otorisasi ditolak";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token kedaluwarsa, otorisasi ditolak";
  } else if (err.isAxiosError) {
    if (err.response) {
      statusCode = err.response.status || 503;
      const responseData = err.response.data;
      message =
        responseData?.message ||
        responseData?.error ||
        `Error berkomunikasi dengan layanan internal (${
          err.config?.url || "unknown service"
        }) - Status: ${statusCode}`;

      errorWithContext("Error response from internal service", err, req, {
        serviceUrl: err.config?.url,
        serviceStatus: err.response.status,
        serviceResponse: responseData,
      });
    } else if (err.request) {
      statusCode = 503;
      message = `Layanan internal tidak merespons (${
        err.config?.url || "unknown service"
      })`;
      errorWithContext("No response from internal service", err, req, {
        serviceUrl: err.config?.url,
      });
    } else {
      statusCode = 500;
      message = "Gagal menyiapkan request ke layanan internal.";
      errorWithContext("Axios request setup error", err, req, {
        serviceUrl: err.config?.url,
      });
    }
  } else if (err.statusCode) {
    statusCode = err.statusCode;
    message =
      typeof err.message === "object" && err.message?.message
        ? err.message.message
        : err.message;
  }

  res.status(statusCode).json({
    message: message,
    stack: config.isProduction ? undefined : err.stack,
  });
};

module.exports = errorHandler;
