const express = require("express");
const {
  handleMulterError,
  imageUpload,
  audioUpload,
} = require("../../../middleware/upload");

const detectController = require("../controllers/detectController");
const scanController = require("../controllers/scanController");
const transcribeController = require("../controllers/transcribeController");

const router = express.Router();

router.post(
  "/detect",
  handleMulterError(imageUpload),
  detectController.detectObject
);
router.post("/scan", handleMulterError(imageUpload), scanController.scanImage);
router.post(
  "/transcribe",
  handleMulterError(audioUpload),
  transcribeController.transcribeAudio
);

module.exports = router;
