const multer = require("multer");

const fileFilter = (allowedMimeTypes) => (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(
      `Tipe file tidak diizinkan. Hanya menerima: ${allowedMimeTypes.join(
        ", "
      )}`
    );
    error.status = 400;
    cb(error, false);
  }
};

exports.imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilter(["image/jpeg", "image/png", "image/jpg"]),
}).single("image");

exports.audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilter([
    "audio/m4a",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/x-m4a",
  ]),
}).single("audio");

exports.handleMulterError = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    if (!req.file) {
      const error = new Error("File tidak ditemukan dalam permintaan.");
      error.status = 400;
      return next(error);
    }
    next();
  });
};
