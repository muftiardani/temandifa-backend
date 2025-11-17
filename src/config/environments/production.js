module.exports = {
  port: process.env.PORT || 3000,

  // Sesuaikan dengan domain frontend
  corsOrigin: "https://app.temandifa.com",
  clientUrl: "https://app.temandifa.com",
  frontendUrl: "https://app.temandifa.com",

  serviceUrls: {
    yoloDetector: "http://yolo-detector:5001",
    ocr: "http://ocr-service:5003",
    voiceTranscriber: "http://voice-transcriber:5002",
  },

  rateLimit: {
    generalMax: 500,
    authMax: 20,
  },
};
