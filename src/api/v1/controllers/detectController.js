const asyncHandler = require("express-async-handler");
const axios = require("axios");
const FormData = require("form-data");
const { yoloDetectorUrl } = require("../../../config/services");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.detectObjects = asyncHandler(async (req, res, next) => {
  logWithContext("info", "Object detection request received", req);

  if (!req.file) {
    logWithContext("warn", "No image file uploaded for detection", req);
    res.status(400);
    throw new Error("File gambar tidak ditemukan.");
  }

  logWithContext(
    "debug",
    `Processing image for detection: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`,
    req
  );

  const formData = new FormData();
  formData.append("image", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    if (!yoloDetectorUrl) {
      throw new Error("YOLO Detector service URL is not configured.");
    }

    logWithContext(
      "debug",
      `Forwarding detection request to YOLO service: ${yoloDetectorUrl}`,
      req
    );

    const response = await axios.post(yoloDetectorUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "X-Request-ID": req.id,
      },
      timeout: 30000,
    });

    logWithContext(
      "info",
      `Object detection successful from YOLO service`,
      req
    );

    res.status(200).json(response.data);
  } catch (error) {
    errorWithContext(
      "Error communicating with YOLO detector service",
      error,
      req
    );

    next(error);
  }
});
