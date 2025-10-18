const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  console.error(err);

  if (err.name === "ValidationError") {
    statusCode = 422;
    message = "Data yang Anda masukkan tidak valid. Mohon periksa kembali.";
  }

  if (err.code && err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue);
    message = `Data untuk '${field}' sudah ada. Silakan gunakan data lain.`;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Token tidak valid. Silakan login kembali.";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Sesi Anda telah berakhir. Silakan login kembali.";
  }

  if (statusCode === 500) {
    message = "Terjadi masalah pada server. Tim kami sedang menanganinya.";
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = errorHandler;
