const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { logWithContext, errorWithContext } = require("../config/logger");
const config = require("../config/appConfig");

const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/jpg",
];

const ALLOWED_AUDIO_MIMES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/x-m4a",
];

const tempUploadDir = path.join(__dirname, "../../temp_uploads");
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const limits = {
  fileSize: config.upload.maxFileSizeBytes,
};

/**
 * Factory function (Refaktor Tahap 5)
 * Membuat fungsi fileFilter untuk multer berdasarkan tipe MIME yang diizinkan.
 *
 * @param {string[]} allowedMimeTypes - Array berisi tipe MIME yang diizinkan
 * @returns {function(req, file, cb)} - Fungsi fileFilter untuk multer
 */
const createFileFilter = (allowedMimeTypes) => (req, file, cb) => {
  logWithContext("debug", `Filtering uploaded file`, req, {
    filename: file.originalname,
    mimetype: file.mimetype,
  });

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    logWithContext("warn", `Invalid file type uploaded`, req, {
      filename: file.originalname,
      mimetype: file.mimetype,
      allowed: allowedMimeTypes,
    });
    const error = new Error(
      `Tipe file tidak valid. Hanya ${allowedMimeTypes.join(
        ", "
      )} yang diizinkan.`
    );
    error.code = "INVALID_FILE_TYPE";
    cb(error, false);
  }
};

const imageUpload = multer({
  storage,
  fileFilter: createFileFilter(ALLOWED_IMAGE_MIMES),
  limits,
}).single("image");

const audioUpload = multer({
  storage,
  fileFilter: createFileFilter(ALLOWED_AUDIO_MIMES),
  limits,
}).single("audio");

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let statusCode = 400;
    let message = `Kesalahan upload file: ${err.message}`;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = `Ukuran file terlalu besar. Maksimum ${config.upload.maxFileSizeMb}MB.`;
        statusCode = 413;
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = `Nama field file tidak terduga. Harap gunakan field yang benar ('image' atau 'audio').`;
        break;
    }

    errorWithContext("Multer Error during file upload", err, req, {
      multerCode: err.code,
    });

    const multerError = new Error(message);
    multerError.statusCode = statusCode;
    multerError.code = err.code;
    return next(multerError);
  } else if (err && err.code === "INVALID_FILE_TYPE") {
    errorWithContext("Invalid File Type Error during upload", err, req);
    const fileTypeError = new Error(err.message);
    fileTypeError.statusCode = 415;
    return next(fileTypeError);
  } else if (err) {
    errorWithContext(
      "Unknown Error during file upload middleware chain",
      err,
      req
    );
  }

  next(err);
};

module.exports = {
  imageUpload,
  audioUpload,
  handleMulterError,
};
