require("dotenv").config();

const yoloDetectorUrl =
  process.env.YOLO_DETECTOR_URL || "http://yolo-detector:5001";

const ocrServiceUrl = process.env.OCR_SERVICE_URL || "http://ocr-service:5003";

const voiceTranscriberUrl =
  process.env.VOICE_TRANSCRIBER_URL || "http://voice-transcriber:5002";

module.exports = {
  yoloDetectorUrl,
  ocrServiceUrl,
  voiceTranscriberUrl,
};
