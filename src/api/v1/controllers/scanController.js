const asyncHandler = require("express-async-handler");
const config = require("../../../config/appConfig");
const { forwardFileToAIService } = require("../services/aiProxyService");

const ocrServiceUrl = config.serviceUrls.ocr;

const OCR_TIMEOUT = 45000;
const OCR_SERVICE_NAME = "OCR Service";
const FIELD_NAME = "image";

/**
 * @desc    Memindai gambar untuk ekstraksi teks (OCR)
 * @route   POST /api/v1/scan
 * @access  Protected (via authMiddleware di rute)
 */
exports.scanImage = asyncHandler(async (req, res, next) => {
  await forwardFileToAIService(
    req,
    res,
    next,
    ocrServiceUrl,
    FIELD_NAME,
    OCR_TIMEOUT,
    OCR_SERVICE_NAME
  );
});
