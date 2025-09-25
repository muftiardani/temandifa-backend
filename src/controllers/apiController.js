const axios = require("axios");
const FormData = require("form-data");
const Tesseract = require("tesseract.js");
const logger = require("../config/logger"); // Impor logger Winston

// Ambil URL layanan dari environment variables dengan fallback ke localhost
const DETECTOR_URL = process.env.DETECTOR_URL || "http://localhost:5001/detect";
const TRANSCRIBER_URL =
  process.env.TRANSCRIBER_URL || "http://localhost:5002/transcribe";

/**
 * Menerima file gambar, meneruskannya ke layanan deteksi objek Python,
 * dan mengembalikan hasilnya.
 */
exports.detectObject = async (req, res) => {
  if (!req.file) {
    logger.warn("Percobaan deteksi objek tanpa file.");
    return res
      .status(400)
      .json({ error: "Tidak ada file gambar yang diunggah" });
  }

  try {
    const formData = new FormData();
    formData.append("image", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    logger.info(`Meneruskan permintaan deteksi objek ke: ${DETECTOR_URL}`);
    const response = await axios.post(DETECTOR_URL, formData, {
      headers: formData.getHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    logger.error("Error saat berkomunikasi dengan layanan deteksi objek:", {
      message: error.message,
      stack: error.stack,
      response: error.response ? error.response.data : "No response data",
    });
    res
      .status(500)
      .json({ error: "Gagal memproses gambar untuk deteksi objek" });
  }
};

/**
 * Menerima file gambar, melakukan OCR menggunakan Tesseract.js,
 * dan mengembalikan teks yang terdeteksi.
 */
exports.scanImage = async (req, res) => {
  if (!req.file) {
    logger.warn("Percobaan pemindaian gambar tanpa file.");
    return res
      .status(400)
      .json({ error: "Tidak ada file gambar yang diunggah" });
  }

  logger.info("Memulai proses OCR untuk gambar:", {
    filename: req.file.originalname,
  });

  try {
    const {
      data: { text },
    } = await Tesseract.recognize(
      req.file.buffer,
      "ind", // Menggunakan bahasa Indonesia
      {
        logger: (m) => logger.info(`Status Tesseract: ${JSON.stringify(m)}`),
      }
    );

    logger.info("Proses OCR berhasil.");
    res.json({ scannedText: text });
  } catch (error) {
    logger.error("Error saat melakukan OCR:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Gagal memindai teks dari gambar" });
  }
};

/**
 * Menerima file audio, meneruskannya ke layanan transkripsi Python,
 * dan mengembalikan hasilnya.
 */
exports.transcribeAudio = async (req, res) => {
  if (!req.file) {
    logger.warn("Percobaan transkripsi audio tanpa file.");
    return res
      .status(400)
      .json({ error: "Tidak ada file audio yang diunggah" });
  }

  try {
    const formData = new FormData();
    formData.append("audio", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    logger.info(
      `Meneruskan permintaan transkripsi audio ke: ${TRANSCRIBER_URL}`
    );
    const response = await axios.post(TRANSCRIBER_URL, formData, {
      headers: formData.getHeaders(),
    });

    res.json(response.data);
  } catch (error) {
    logger.error("Error saat berkomunikasi dengan layanan transkripsi:", {
      message: error.message,
      stack: error.stack,
      response: error.response ? error.response.data : "No response data",
    });
    res.status(500).json({ error: "Gagal memproses audio untuk transkripsi" });
  }
};
