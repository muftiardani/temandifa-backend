require("dotenv").config();

const serviceUrl = {
  detector: process.env.YOLO_DETECTOR_URL,
  ocr: process.env.OCR_SERVICE_URL,
  transcriber: process.env.VOICE_TRANSCRIBER_URL,
};

module.exports = { serviceUrl };
