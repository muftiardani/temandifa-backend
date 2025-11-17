module.exports = {
  corsOrigin: "*",
  clientUrl: "*",
  frontendUrl: "http://localhost:8081",

  serviceUrls: {
    yoloDetector: "http://yolo-detector:5001",
    ocr: "http://ocr-service:5003",
    voiceTranscriber: "http://voice-transcriber:5002",
  },
};
