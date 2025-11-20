const express = require("express");
const {
  imageUpload,
  audioUpload,
  handleMulterError,
} = require("../../../middleware/upload");
const { validateFileContent } = require("../../../middleware/fileValidator");
const { createProxyHandler } = require("../services/aiProxyService");
const config = require("../../../config/appConfig");
const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const contactRoutes = require("./contactRoutes");
const userRoutes = require("./userRoutes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);

router.post(
  "/detect",
  imageUpload,
  handleMulterError,
  validateFileContent(["image"]),
  createProxyHandler(
    config.serviceUrls.yoloDetector,
    "image",
    30000,
    "YOLO Detector"
  )
);

router.post(
  "/scan",
  imageUpload,
  handleMulterError,
  validateFileContent(["image"]),
  createProxyHandler(config.serviceUrls.ocr, "image", 45000, "OCR Service")
);

router.post(
  "/transcribe",
  audioUpload,
  handleMulterError,
  validateFileContent(["audio"]),
  createProxyHandler(
    config.serviceUrls.voiceTranscriber,
    "audio",
    90000,
    "Voice Transcriber"
  )
);

module.exports = router;
