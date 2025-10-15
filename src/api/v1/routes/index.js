const express = require("express");
const router = express.Router();
const { protect } = require("../../../middleware/authMiddleware");

const {
  imageUpload,
  audioUpload,
  handleMulterError,
} = require("../../../middleware/upload");

const authRoutes = require("./authRoutes");
const callRoutes = require("./callRoutes");
const contactRoutes = require("./contactRoutes");
const userRoutes = require("./userRoutes");

const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");

router.post(
  "/detect",
  protect,
  handleMulterError(imageUpload),
  detectController.detectObject
);
router.post(
  "/scan",
  protect,
  handleMulterError(imageUpload),
  scanController.scanImage
);
router.post(
  "/transcribe",
  protect,
  handleMulterError(audioUpload),
  transcribeController.transcribeAudio
);

router.use("/auth", authRoutes);
router.use("/call", callRoutes);
router.use("/contacts", contactRoutes);
router.use("/users", userRoutes);

module.exports = router;
