const axios = require("axios");
const FormData = require("form-data");
const { logWithContext, errorWithContext } = require("../../../config/logger");

/**
 * Meneruskan file yang diunggah ke layanan AI internal.
 * Fungsi ini menangani pembuatan FormData, pemanggilan Axios, dan penerusan error.
 *
 * @param {object} req - Objek request Express (harus berisi req.file dan req.id).
 * @param {object} res - Objek response Express.
 * @param {function} next - Fungsi next middleware Express.
 * @param {string} serviceUrl - URL layanan AI tujuan (mis. http://yolo-detector:5001).
 * @param {string} fieldName - Nama field form-data untuk file ('image' atau 'audio').
 * @param {number} timeout - Waktu timeout request dalam milidetik.
 * @param {string} serviceName - Nama layanan AI untuk logging (mis. 'YOLO Detector').
 */
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
      `Error communicating with ${serviceName} service`,
      error,
      req
    );
    next(error);
  }
};

module.exports = {
  forwardFileToAIService,
};
