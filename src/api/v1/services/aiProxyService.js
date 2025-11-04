const axios = require("axios");
const FormData = require("form-data");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const asyncHandler = require("express-async-handler");
const axiosRetry = require("axios-retry").default;

axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    logWithContext(
      "warn",
      `Percobaan ulang ${retryCount} gagal untuk ${error.config.url}`,
      null,
      {
        service: error.config.url,
        retryCount,
        errorMessage: error.message,
      }
    );
    return axiosRetry.exponentialDelay(retryCount, error, 100);
  },
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500)
    );
  },
});

const forwardFileToAIService = async (
  req,
  res,
  next,
  serviceUrl,
  fieldName,
  timeout,
  serviceName
) => {
  logWithContext("info", `${serviceName} request received`, req);

  if (!req.file) {
    logWithContext(
      `warn`,
      `No ${fieldName} file uploaded for ${serviceName}`,
      req
    );
    res.status(400);
    return next(new Error(`File ${fieldName} tidak ditemukan.`));
  }

  logWithContext(
    "debug",
    `Processing ${fieldName} for ${serviceName}: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`,
    req
  );

  const formData = new FormData();
  formData.append(fieldName, req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    if (!serviceUrl) {
      const configError = new Error(
        `URL Layanan ${serviceName} tidak dikonfigurasi.`
      );
      errorWithContext(
        `${serviceName} Service URL is not configured`,
        configError,
        req
      );
      return next(configError);
    }

    logWithContext(
      "debug",
      `Forwarding request to ${serviceName} service: ${serviceUrl}`,
      req
    );

    const response = await axios.post(serviceUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "X-Request-ID": req.id,
      },
      timeout: timeout,
    });

    logWithContext(
      "info",
      `${serviceName} request successful from service`,
      req
    );

    res.status(200).json(response.data);
  } catch (error) {
    errorWithContext(
      `Error communicating with ${serviceName} service (after retries)`,
      error,
      req
    );
    next(error);
  }
};

const createProxyHandler = (serviceUrl, fieldName, timeout, serviceName) => {
  return asyncHandler(async (req, res, next) => {
    await forwardFileToAIService(
      req,
      res,
      next,
      serviceUrl,
      fieldName,
      timeout,
      serviceName
    );
  });
};

module.exports = {
  forwardFileToAIService,
  createProxyHandler,
};
