const asyncHandler = require("express-async-handler");
const config = require("../../../config/appConfig");
const { forwardFileToAIService } = require("../services/aiProxyService");

const voiceTranscriberUrl = config.serviceUrls.voiceTranscriber;

const TRANSCRIBER_TIMEOUT = 90000;
const TRANSCRIBER_SERVICE_NAME = "Voice Transcriber";
const FIELD_NAME = "audio";

/**
 * @desc    Mentranskripsi file audio menjadi teks
 * @route   POST /api/v1/transcribe
 * @access  Protected (via authMiddleware di rute)
 */
exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  await forwardFileToAIService(
    req,
    res,
    next,
    voiceTranscriberUrl,
    FIELD_NAME,
    TRANSCRIBER_TIMEOUT,
    TRANSCRIBER_SERVICE_NAME
  );
});
