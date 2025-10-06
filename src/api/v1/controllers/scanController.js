const axios = require("axios");
const FormData = require("form-data");
const { serviceUrl } = require("../../../config/services");

const scan = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error("File gambar tidak ditemukan.");
      error.status = 400;
      throw error;
    }

    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await axios.post(serviceUrl.ocr, formData, {
      headers: formData.getHeaders(),
    });

    res.status(200).json(response.data);
  } catch (error) {
    next(error);
  }
};

module.exports = { scan };
