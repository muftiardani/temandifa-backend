require("dotenv").config();
const ms = require("ms");

/**
 * Mendapatkan nilai integer dari environment variable.
 * @param {string} key - Nama environment variable.
 * @param {number} defaultValue - Nilai default jika tidak ditemukan atau NaN.
 * @returns {number}
 */
const getIntEnv = (key, defaultValue) => {
  const value = parseInt(process.env[key], 10);
  return isNaN(value) ? defaultValue : value;
};

/**
 * Mendapatkan durasi dalam DETIK dari environment variable.
 * @param {string} key - Nama environment variable.
 * @param {string} defaultValueString - String durasi default (cth: '15m').
 * @returns {number} - Durasi dalam detik.
 */
const getDurationSecondsEnv = (key, defaultValueString) => {
  const valueString = process.env[key] || defaultValueString;
  try {
    const msValue = ms(valueString);
    if (msValue === undefined) {
      console.warn(
        `[Config] Format durasi invalid untuk env var ${key}: "${valueString}". Menggunakan default: "${defaultValueString}"`
      );
      return ms(defaultValueString) / 1000;
    }
    return msValue / 1000;
  } catch (e) {
    console.warn(
      `[Config] Error parsing durasi untuk env var ${key}: "${valueString}". Menggunakan default: "${defaultValueString}"`
    );
    return ms(defaultValueString) / 1000;
  }
};

/**
 * Mendapatkan durasi dalam MILIDETIK dari environment variable.
 * @param {string} key - Nama environment variable.
 * @param {string} defaultValueString - String durasi default (cth: '15m').
 * @returns {number} - Durasi dalam milidetik.
 */
const getDurationMsEnv = (key, defaultValueString) => {
  const valueString = process.env[key] || defaultValueString;
  try {
    const msValue = ms(valueString);
    if (msValue === undefined) {
      console.warn(
        `[Config] Format durasi invalid untuk env var ${key}: "${valueString}". Menggunakan default: "${defaultValueString}"`
      );
      return ms(defaultValueString);
    }
    return msValue;
  } catch (e) {
    console.warn(
      `[Config] Error parsing durasi untuk env var ${key}: "${valueString}". Menggunakan default: "${defaultValueString}"`
    );
    return ms(defaultValueString);
  }
};

const config = {
  port: getIntEnv("PORT", 3000),
  metricsPort: getIntEnv("METRICS_PORT", 9100),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",

  mongoUri: process.env.MONGO_URI || "mongodb://mongo:27017/temandifa_db",
  redisUri:
    process.env.REDIS_URI ||
    `redis://${process.env.REDIS_HOST || "redis"}:${
      process.env.REDIS_PORT || 6379
    }`,

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRE || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || "7d",
    refreshExpiresInMs: getDurationMsEnv("JWT_REFRESH_EXPIRE", "7d"),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
    validAudiences: [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean),
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: getIntEnv("EMAIL_PORT", 587),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    from: process.env.EMAIL_FROM || "no-reply@yourdomain.com",
    fromName: process.env.EMAIL_FROM_NAME || "TemanDifa App",
    resetPasswordTokenExpireMinutes: 10,
  },

  agora: {
    appId: process.env.AGORA_APP_ID,
    appCertificate: process.env.AGORA_APP_CERTIFICATE,
    tokenExpirationSeconds: 3600,
  },

  serviceUrls: {
    yoloDetector: process.env.YOLO_DETECTOR_URL || "http://yolo-detector:5001",
    ocr: process.env.OCR_SERVICE_URL || "http://ocr-service:5003",
    voiceTranscriber:
      process.env.VOICE_TRANSCRIBER_URL || "http://voice-transcriber:5002",
  },

  frontendUrl: process.env.FRONTEND_URL || "http://localhost:8081",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  clientUrl: process.env.CLIENT_URL || "*",

  rateLimit: {
    generalWindowMs: 15 * 60 * 1000,
    generalMax: 100,
    authWindowMs: 15 * 60 * 1000,
    authMax: 10,
  },

  call: {
    ringingTtlSeconds: 60,
    activeTtlSeconds: 3600 * 2,
  },

  upload: {
    maxFileSizeMb: 25,
    maxFileSizeBytes: 25 * 1024 * 1024,
  },
};

if (!config.jwt.secret) {
  throw new Error(
    "[Config FATAL] JWT_SECRET tidak ditemukan di environment variables."
  );
}
if (!config.jwt.refreshSecret) {
  throw new Error(
    "[Config FATAL] JWT_REFRESH_SECRET tidak ditemukan di environment variables."
  );
}
if (!config.mongoUri) {
  throw new Error(
    "[Config FATAL] MONGO_URI tidak ditemukan di environment variables."
  );
}
if (!config.agora.appId || !config.agora.appCertificate) {
  console.warn(
    "[Config WARN] AGORA_APP_ID atau AGORA_APP_CERTIFICATE tidak ditemukan. Fitur panggilan video akan gagal."
  );
}
if (!config.google.clientId) {
  console.warn(
    "[Config WARN] GOOGLE_CLIENT_ID tidak ditemukan. Login Google mungkin akan gagal."
  );
}
if (config.isProduction && !config.email.host) {
  console.warn(
    "[Config WARN] Konfigurasi Email (EMAIL_HOST) tidak ditemukan. Fitur reset password tidak akan berfungsi."
  );
}

module.exports = config;
