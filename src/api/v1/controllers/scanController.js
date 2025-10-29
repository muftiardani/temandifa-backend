const asyncHandler = require("express-async-handler");
const axios = require("axios");
const FormData = require("form-data");
const { ocrServiceUrl } = require("../../../config/services");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.scanImage = asyncHandler(async (req, res, next) => {
  logWithContext("info", "Image scan request received", req);

  if (!req.file) {
    logWithContext("warn", "No image file uploaded for scanning", req);
    res.status(400);
    throw new Error("File gambar tidak ditemukan.");
  }

  logWithContext(
    "debug",
    `Processing image for scan: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`,
    req
  );

  const formData = new FormData();
  formData.append("image", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    if (!ocrServiceUrl) {
      errorWithContext(
        "OCR Service URL is not configured in services.js",
        new Error("Configuration Error"),
        req
      );
      throw new Error("Konfigurasi layanan OCR tidak ditemukan.");
    }

    logWithContext(
      "debug",
      `Forwarding scan request to OCR service: ${ocrServiceUrl}`,
      req
    );

    const response = await axios.post(ocrServiceUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "X-Request-ID": req.id,
      },
      timeout: 45000,
    });

    logWithContext("info", `Image scan successful from OCR service`, req);

    res.status(200).json(response.data);
  } catch (error) {
    errorWithContext("Error communicating with OCR service", error, req);

    next(error);
  }
});
