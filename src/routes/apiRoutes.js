const express = require("express");
const { body } = require("express-validator");
const multer = require("multer");
const apiController = require("../controllers/apiController");
const path = require("path");

const router = express.Router();

const fileFilter = (allowedTypes) => (req, file, cb) => {
  if (allowedTypes.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipe file tidak diizinkan: ${file.mimetype}`), false);
  }
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter(/jpeg|jpg|png/),
}).single("image");

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilter(/m4a|mp3|wav|mpeg/),
}).single("audio");

const handleMulterError = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `File Error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: `Tidak ada file yang diunggah.` });
    }
    next();
  });
};

router.post(
  "/detect",
  handleMulterError(imageUpload),
  apiController.detectObject
);
router.post("/scan", handleMulterError(imageUpload), apiController.scanImage);
router.post(
  "/transcribe",
  handleMulterError(audioUpload),
  apiController.transcribeAudio
);

module.exports = router;
