const express = require("express");
const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const contactRoutes = require("./contactRoutes");
const userRoutes = require("./userRoutes");
const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");
const {
  imageUpload,
  audioUpload,
  handleMulterError,
} = require("../../../middleware/upload");

const router = express.Router();

// Menggunakan rute modular
router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);

/**
 * @swagger
 * tags:
 * name: AI Services
 * description: Endpoints for AI-based processing
 */

/**
 * @swagger
 * /detect:
 * post:
 * summary: Detect objects in an image
 * tags: [AI Services]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * image:
 * type: string
 * format: binary
 * responses:
 * 200:
 * description: A list of detected objects with their bounding boxes and confidence scores.
 * 500:
 * description: Internal Server Error
 */
router.post(
  "/detect",
  handleMulterError(imageUpload),
  detectController.detectObjects
);

/**
 * @swagger
 * /scan:
 * post:
 * summary: Perform OCR on an image to extract text
 * tags: [AI Services]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * image:
 * type: string
 * format: binary
 * responses:
 * 200:
 * description: The scanned text from the image.
 * 500:
 * description: Internal Server Error
 */
router.post(
  "/scan",
  handleMulterError(imageUpload),
  scanController.scanImage
);

/**
 * @swagger
 * /transcribe:
 * post:
 * summary: Transcribe an audio file to text
 * tags: [AI Services]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * multipart/form-data:
 * schema:
 * type: object
 * properties:
 * audio:
 * type: string
 * format: binary
 * responses:
 * 200:
 * description: The transcribed text from the audio.
 * 500:
 * description: Internal Server Error
 */
router.post(
  "/transcribe",
  handleMulterError(audioUpload),
  transcribeController.transcribeAudio
);

module.exports = router;
