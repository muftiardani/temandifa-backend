const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const Tesseract = require("tesseract.js");

const DETECT_API_URL = process.env.DETECT_API_URL;
const TRANSCRIBE_API_URL = process.env.TRANSCRIBE_API_URL;

/**
 * Menerima gambar, meneruskannya ke API Python YOLO untuk deteksi objek,
 * dan mengembalikan hasilnya.
 */
const detectObjects = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah." });
  }

  const imagePath = req.file.path;

  try {
    const formData = new FormData();
    formData.append("image", fs.createReadStream(imagePath), {
      filename: "image.jpg",
    });

    // Mengirim gambar ke layanan deteksi objek Python
    const response = await axios.post(DETECT_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error saat berkomunikasi dengan API Python:", error.message);
    res.status(500).json({
      error: "Gagal berkomunikasi dengan layanan deteksi.",
      details: error.response
        ? error.response.data
        : "Server Python tidak merespons.",
    });
  } finally {
    fs.unlink(imagePath, (err) => {
      if (err) console.error("Gagal menghapus file sementara:", err);
    });
  }
};

/**
 * Menerima gambar dan melakukan Optical Character Recognition (OCR)
 * untuk mengekstrak teks di dalamnya menggunakan Tesseract.js.
 */
const scanImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah." });
  }

  const imagePath = req.file.path;

  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, "ind"); // Menggunakan model bahasa Indonesia

    res.json({ scannedText: text });
  } catch (error) {
    console.error("Error saat proses OCR:", error);
    res
      .status(500)
      .json({ error: "Terjadi kesalahan di server saat memindai gambar." });
  } finally {
    fs.unlink(imagePath, (err) => {
      if (err) console.error("Gagal menghapus file sementara (OCR):", err);
    });
  }
};

/**
 * Menerima file audio dan meneruskannya ke API Python Whisper untuk transkripsi.
 */
const transcribeAudio = async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: "Tidak ada file audio yang diunggah." });
  }

  const audioPath = req.file.path;
  console.log("Meneruskan audio ke API Python Whisper:", audioPath);

  try {
    const formData = new FormData();
    formData.append("audio", fs.createReadStream(audioPath), {
      filename: "recording.m4a",
    });

    // Kirim permintaan ke server transkripsi
    const response = await axios.post(TRANSCRIBE_API_URL, formData, {
      headers: { ...formData.getHeaders() },
    });

    res.json(response.data);
  } catch (error) {
    console.error(
      "Error saat berkomunikasi dengan API Transkripsi:",
      error.message
    );
    res.status(500).json({
      error: "Gagal berkomunikasi dengan layanan transkripsi.",
      details: error.response
        ? error.response.data
        : "Server Python tidak merespons.",
    });
  } finally {
    fs.unlink(audioPath, (err) => {
      if (err) console.error("Gagal menghapus file audio sementara:", err);
    });
  }
};

module.exports = {
  detectObjects,
  scanImage,
  transcribeAudio,
};
