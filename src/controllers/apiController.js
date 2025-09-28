const axios = require("axios");
const FormData = require("form-data");
const logger = require("../config/logger");

const DETECTOR_URL = process.env.DETECTOR_URL;
const TRANSCRIBER_URL = process.env.TRANSCRIBER_URL;
const SCANNER_URL = process.env.SCANNER_URL;

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

const forwardFileToService = async (serviceUrl, req) => {
  const formData = new FormData();
  formData.append(req.file.fieldname, req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  logger.info(`Meneruskan permintaan ke: ${serviceUrl}`);
  const response = await axios.post(serviceUrl, formData, {
    headers: formData.getHeaders(),
  });
  return response.data;
};

exports.detectObject = asyncHandler(async (req, res) => {
  const responseData = await forwardFileToService(DETECTOR_URL, req);
  res.json(responseData);
});

exports.scanImage = asyncHandler(async (req, res) => {
  const responseData = await forwardFileToService(SCANNER_URL, req);
  res.json(responseData);
});

exports.transcribeAudio = asyncHandler(async (req, res) => {
  const responseData = await forwardFileToService(TRANSCRIBER_URL, req);
  res.json(responseData);
});