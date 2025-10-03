const axios = require("axios");
const FormData = require("form-data");
const logger = require("../../../config/logger");

const DETECTOR_URL = process.env.DETECTOR_URL;

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

exports.detectObject = asyncHandler(async (req, res) => {
  const formData = new FormData();
  formData.append("image", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan deteksi ke: ${DETECTOR_URL}`);
  const response = await axios.post(DETECTOR_URL, formData, {
    headers: formData.getHeaders(),
    timeout: 300000,
  });

  res.status(200).json(response.data);
});
