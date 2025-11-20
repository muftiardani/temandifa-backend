const fs = require("fs");
const { errorWithContext, logWithContext } = require("../config/logger");

/**
 * Middleware untuk memvalidasi Magic Numbers (konten asli file)
 * Menggunakan dynamic import karena 'file-type' adalah ESM package.
 * * @param {string[]} allowedTypes - Tipe yang diizinkan: 'image' atau 'audio'
 */
const validateFileContent = (allowedTypes) => async (req, res, next) => {
  if (!req.file) return next();

  const filePath = req.file.path;

  try {
    const { fileTypeFromFile } = await import("file-type");

    const type = await fileTypeFromFile(filePath);

    if (!type) {
      logWithContext(
        "warn",
        "File type detection failed (unknown content)",
        req
      );
      await fs.promises.unlink(filePath);
      const err = new Error("Tipe file tidak valid atau rusak.");
      err.statusCode = 400;
      return next(err);
    }

    const mime = type.mime;
    let isValid = false;

    if (allowedTypes.includes("image") && mime.startsWith("image/"))
      isValid = true;
    if (allowedTypes.includes("audio") && mime.startsWith("audio/"))
      isValid = true;

    if (!isValid) {
      await fs.promises.unlink(filePath);

      logWithContext(
        "warn",
        `Security Alert: File content mismatch. Detected: ${mime}`,
        req,
        {
          originalName: req.file.originalname,
          detectedMime: mime,
        }
      );

      const err = new Error(
        `Konten file tidak valid. Terdeteksi sebagai: ${mime}`
      );
      err.statusCode = 415;
      return next(err);
    }

    logWithContext("debug", `File content validated: ${mime}`, req);
    next();
  } catch (error) {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath).catch(() => {});
    }
    errorWithContext("Error validating file content magic numbers", error, req);
    next(error);
  }
};

module.exports = { validateFileContent };
