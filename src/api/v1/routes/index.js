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

router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);
router.post(
  "/detect",
  handleMulterError(imageUpload),
  detectController.detectObjects
);
router.post(
  "/scan",
  handleMulterError(imageUpload),
  scanController.scanImage
);
router.post(
  "/transcribe",
  handleMulterError(audioUpload),
  transcribeController.transcribeAudio
);

module.exports = router;
