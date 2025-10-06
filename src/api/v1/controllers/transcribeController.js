const axios = require("axios");
const FormData = require("form-data");
const { serviceUrl } = require("../../../config/services");

const transcribe = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("File audio tidak ditemukan.");
      error.status = 400;
      throw error;
    }

    const formData = new FormData();
    formData.append("audio", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(serviceUrl.transcriber, formData, {
      headers: formData.getHeaders(),
    });

    res.status(200).json(response.data);
  } catch (error) {
    next(error);
  }
};

module.exports = { transcribe };
