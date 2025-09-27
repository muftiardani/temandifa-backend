const express = require("express");
const multer = require("multer");
const apiController = require("../controllers/apiController");
const path = require("path");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Batas ukuran file 10MB
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|m4a|mp3|wav/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error(`Error: Tipe file tidak diizinkan - ${file.mimetype}`));
  },
});

router.post("/detect", upload.single("image"), apiController.detectObject);
router.post("/scan", upload.single("image"), apiController.scanImage);
router.post(
  "/transcribe",
  upload.single("audio"),
  apiController.transcribeAudio
);

module.exports = router;
