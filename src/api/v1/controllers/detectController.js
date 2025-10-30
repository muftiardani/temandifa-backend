const asyncHandler = require("express-async-handler");
const config = require("../../../config/appConfig");
const { forwardFileToAIService } = require("../services/aiProxyService");

const yoloDetectorUrl = config.serviceUrls.yoloDetector;

const YOLO_TIMEOUT = 30000;
const YOLO_SERVICE_NAME = "YOLO Detector";
const FIELD_NAME = "image";

/**
 * @desc    Mendeteksi objek dalam gambar
 * @route   POST /api/v1/detect
 * @access  Protected (via authMiddleware di rute)
 */
exports.detectObjects = asyncHandler(async (req, res, next) => {
  await forwardFileToAIService(
    req,
    res,
    next,
    yoloDetectorUrl,
    FIELD_NAME,
    YOLO_TIMEOUT,
    YOLO_SERVICE_NAME
  );
});
