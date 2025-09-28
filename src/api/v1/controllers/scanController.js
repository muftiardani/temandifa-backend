const axios = require("axios");
const FormData = require("form-data");
const logger = require("../../../config/logger");

const SCANNER_URL = process.env.SCANNER_URL;

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

exports.scanImage = asyncHandler(async (req, res) => {
  const formData = new FormData();
  formData.append("image", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan scan ke: ${SCANNER_URL}`);
  const response = await axios.post(SCANNER_URL, formData, {
    headers: formData.getHeaders(),
  });

  res.status(200).json(response.data);
});
