const express = require("express");
const multer = require("multer");
const {
  detectObjects,
  scanImage,
  transcribeAudio,
} = require("../controllers/apiController");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

// Endpoint untuk deteksi objek
router.post("/detect", upload.single("image"), detectObjects);

// Endpoint untuk scan
router.post("/scan", upload.single("image"), scanImage);

// Endpoint untuk transkripsi suara
router.post("/transcribe", upload.single("audio"), transcribeAudio);

module.exports = router;
