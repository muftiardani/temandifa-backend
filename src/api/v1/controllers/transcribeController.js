const asyncHandler = require("express-async-handler");
const axios = require("axios");
const FormData = require("form-data");

exports.transcribeAudio = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    res.status(400);
    throw new Error("File audio tidak ditemukan.");
  }

  const formData = new FormData();
  formData.append("audio", req.file.buffer, {
    filename: req.file.originalname,
    contentType: req.file.mimetype,
  });

  const response = await axios.post(
    process.env.VOICE_TRANSCRIBER_URL,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  res.status(200).json(response.data);
});
