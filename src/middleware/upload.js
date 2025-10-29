const multer = require("multer");
const { logWithContext, errorWithContext } = require("../config/logger");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  logWithContext("debug", `Filtering uploaded file`, req, {
    filename: file.originalname,
    mimetype: file.mimetype,
  });

  let allowedMimeTypes = [];
  const url = req.originalUrl.toLowerCase();

  if (url.includes("/detect") || url.includes("/scan")) {
    allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
      "image/jpg",
    ];
  } else if (url.includes("/transcribe")) {
    allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp4",
      "audio/m4a",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/aac",
      "audio/x-m4a",
    ];
  } else {
    logWithContext(
      "warn",
      `Upload attempted on unspecified or disallowed route: ${req.originalUrl}`,
      req
    );
    return cb(new Error("Upload file tidak diizinkan untuk rute ini."), false);
  }

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

const limits = {
  fileSize: 25 * 1024 * 1024,
};

const imageUpload = multer({ storage, fileFilter, limits }).single("image");
const audioUpload = multer({ storage, fileFilter, limits }).single("audio");

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let statusCode = 400;
    let message = `Kesalahan upload file: ${err.message}`;

    switch (err.code) {
      case "LIMIT_FILE_SIZE":
        message = `Ukuran file terlalu besar. Maksimum ${
          limits.fileSize / 1024 / 1024
        }MB.`;
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
  } else if (
    err &&
    err.message === "Upload file tidak diizinkan untuk rute ini."
  ) {
    errorWithContext("Disallowed Route Upload Error", err, req);
    const routeError = new Error(err.message);
    routeError.statusCode = 403;
    return next(routeError);
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
