const asyncHandler = require("express-async-handler");
const axios = require("axios");
const FormData = require("form-data");
const { voiceTranscriberUrl } = require("../../../config/services");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  logWithContext("info", "Audio transcription request received", req);

  if (!req.file) {
    logWithContext("warn", "No audio file uploaded for transcription", req);
    res.status(400);
    throw new Error("File audio tidak ditemukan.");
  }

  logWithContext(
    "debug",
    `Processing audio for transcription: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`,
    req
  );

  const formData = new FormData();
  formData.append("audio", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  try {
    if (!voiceTranscriberUrl) {
      errorWithContext(
        "Voice Transcriber service URL is not configured in services.js",
        new Error("Configuration Error"),
        req
      );
      throw new Error("Konfigurasi layanan transkripsi tidak ditemukan.");
    }

    logWithContext(
      "debug",
      `Forwarding transcription request to Voice Transcriber service: ${voiceTranscriberUrl}`,
      req
    );

    const response = await axios.post(voiceTranscriberUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        "X-Request-ID": req.id,
      },
      timeout: 90000,
    });

    logWithContext(
      "info",
      `Audio transcription successful from Voice Transcriber service`,
      req
    );

    res.status(200).json(response.data);
  } catch (error) {
    errorWithContext(
      "Error communicating with Voice Transcriber service",
      error,
      req
    );

    next(error);
  }
});
