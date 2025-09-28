const axios = require("axios");
const FormData = require("form-data");
const Tesseract = require("tesseract.js");
const logger = require("../config/logger");

const DETECTOR_URL = process.env.DETECTOR_URL;
const TRANSCRIBER_URL = process.env.TRANSCRIBER_URL;

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

exports.detectObject = asyncHandler(async (req, res, next) => {
  const formData = new FormData();
  formData.append("image", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan deteksi objek ke: ${DETECTOR_URL}`);
  const response = await axios.post(DETECTOR_URL, formData, {
    headers: formData.getHeaders(),
  });

  res.json(response.data);
});

exports.scanImage = asyncHandler(async (req, res, next) => {
  logger.info("Memulai proses OCR untuk gambar:", {
    filename: req.file.originalname,
  });

  const {
    data: { text },
  } = await Tesseract.recognize(req.file.buffer, "ind", {
    logger: (m) => logger.info(`Status Tesseract: ${JSON.stringify(m)}`),
  });

  logger.info("Proses OCR berhasil.");
  res.json({ scannedText: text });
});

exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  const formData = new FormData();
  formData.append("audio", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan transkripsi audio ke: ${TRANSCRIBER_URL}`);
  const response = await axios.post(TRANSCRIBER_URL, formData, {
    headers: formData.getHeaders(),
  });

  res.json(response.data);
});
