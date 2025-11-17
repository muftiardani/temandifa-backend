require("dotenv").config();
const { z } = require("zod");
const ms = require("ms");

const envSchema = z.object({
  // Konfigurasi Server
  PORT: z.coerce.number().int().default(3000),
  METRICS_PORT: z.coerce.number().int().default(9100),
  NODE_ENV: z.enum(["development", "production"]).default("development"),

  // Database & Cache
  MONGO_URI: z.string().url("MONGO_URI harus berupa URL yang valid"),
  REDIS_URI: z.string().url("REDIS_URI harus berupa URL yang valid"),

  // JWT Secrets
  JWT_SECRET: z.string().min(1, "JWT_SECRET wajib diisi"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET wajib diisi"),
  JWT_EXPIRE: z.string().default("15m"),
  JWT_REFRESH_EXPIRE: z.string().default("7d"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID wajib diisi"),
  GOOGLE_ANDROID_CLIENT_ID: z
    .string()
    .min(1, "GOOGLE_ANDROID_CLIENT_ID wajib diisi"),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1, "GOOGLE_IOS_CLIENT_ID wajib diisi"),

  // Email Service (Opsional di dev, wajib di prod)
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().int().default(587),
  EMAIL_SECURE: z.coerce.boolean().default(false),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@yourdomain.com"),
  EMAIL_FROM_NAME: z.string().default("TemanDifa App"),

  // Agora (Wajib untuk fitur call)
  AGORA_APP_ID: z.string().min(1, "AGORA_APP_ID wajib diisi"),
  AGORA_APP_CERTIFICATE: z.string().min(1, "AGORA_APP_CERTIFICATE wajib diisi"),

  // Microservice URLs
  YOLO_DETECTOR_URL: z.string().url().default("http://yolo-detector:5001"),
  OCR_SERVICE_URL: z.string().url().default("http://ocr-service:5003"),
  VOICE_TRANSCRIBER_URL: z
    .string()
    .url()
    .default("http://voice-transcriber:5002"),

  // Frontend URLs
  FRONTEND_URL: z.string().url().default("http://localhost:8081"),
  CORS_ORIGIN: z.string().default("*"),
  CLIENT_URL: z.string().default("*"),
});

/**
 * Mem-parse dan memvalidasi environment variables
 */
let config;
try {
  const env = envSchema.parse(process.env);

  const isProduction = env.NODE_ENV === "production";

  // Validasi tambahan
  if (isProduction && !env.EMAIL_HOST) {
    throw new Error(
      "[Config FATAL] EMAIL_HOST wajib diisi saat NODE_ENV=production."
    );
  }

  // Helper untuk parsing durasi
  const getDurationMs = (durationString) => {
    try {
      const msValue = ms(durationString);
      if (msValue === undefined) return ms("7d");
      return msValue;
    } catch (e) {
      return ms("7d");
    }
  };

  config = {
    port: env.PORT,
    metricsPort: env.METRICS_PORT,
    nodeEnv: env.NODE_ENV,
    isProduction: isProduction,

    mongoUri: env.MONGO_URI,
    redisUri: env.REDIS_URI,

    jwt: {
      secret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_EXPIRE,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRE,
      refreshExpiresInMs: getDurationMs(env.JWT_REFRESH_EXPIRE),
    },

    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      androidClientId: env.GOOGLE_ANDROID_CLIENT_ID,
      iosClientId: env.GOOGLE_IOS_CLIENT_ID,
      validAudiences: [
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_ANDROID_CLIENT_ID,
        env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean),
    },

    email: {
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT,
      secure: env.EMAIL_SECURE,
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
      from: env.EMAIL_FROM,
      fromName: env.EMAIL_FROM_NAME,
      resetPasswordTokenExpireMinutes: 10,
    },

    agora: {
      appId: env.AGORA_APP_ID,
      appCertificate: env.AGORA_APP_CERTIFICATE,
      tokenExpirationSeconds: 3600,
    },

    serviceUrls: {
      yoloDetector: env.YOLO_DETECTOR_URL,
      ocr: env.OCR_SERVICE_URL,
      voiceTranscriber: env.VOICE_TRANSCRIBER_URL,
    },

    frontendUrl: env.FRONTEND_URL,
    corsOrigin: env.CORS_ORIGIN,
    clientUrl: env.CLIENT_URL,

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
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Gagal memvalidasi environment variables:", error.format());
  } else {
    console.error(error.message);
  }
  process.exit(1);
}

module.exports = config;
