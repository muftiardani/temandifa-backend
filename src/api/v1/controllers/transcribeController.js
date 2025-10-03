const axios = require("axios");
const FormData = require("form-data");
const logger = require("../../../config/logger");

const TRANSCRIBER_URL = process.env.TRANSCRIBER_URL;

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

exports.transcribeAudio = asyncHandler(async (req, res) => {
  const formData = new FormData();
  formData.append("audio", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan transkripsi ke: ${TRANSCRIBER_URL}`);
  const response = await axios.post(TRANSCRIBER_URL, formData, {
    headers: formData.getHeaders(),
    timeout: 300000,
  });

  res.status(200).json(response.data);
});