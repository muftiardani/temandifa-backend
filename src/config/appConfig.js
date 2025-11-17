require("dotenv").config();
const { z } = require("zod");
const ms = require("ms");
const deepmerge = require("deepmerge");
const path = require("path");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  MONGO_URI: z.string().url("MONGO_URI harus berupa URL yang valid"),
  REDIS_URI: z.string().url("REDIS_URI harus berupa URL yang valid"),

  JWT_SECRET: z.string().min(1, "JWT_SECRET wajib diisi"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET wajib diisi"),

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID wajib diisi"),
  GOOGLE_ANDROID_CLIENT_ID: z
    .string()
    .min(1, "GOOGLE_ANDROID_CLIENT_ID wajib diisi"),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1, "GOOGLE_IOS_CLIENT_ID wajib diisi"),

  AGORA_APP_ID: z.string().min(1, "AGORA_APP_ID wajib diisi"),
  AGORA_APP_CERTIFICATE: z.string().min(1, "AGORA_APP_CERTIFICATE wajib diisi"),

  EMAIL_HOST: z.string().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error(
    "FATAL ERROR: Gagal memvalidasi environment variables:",
    error.format()
  );
  process.exit(1);
}

const isProduction = env.NODE_ENV === "production";

if (isProduction && !env.EMAIL_HOST) {
  console.error(
    "[Config FATAL] EMAIL_HOST wajib diisi saat NODE_ENV=production."
  );
  process.exit(1);
}

const baseConfig = require("./environments/base");
let envConfig = {};

try {
  const envConfigFile = `./environments/${env.NODE_ENV}.js`;
  envConfig = require(path.join(__dirname, envConfigFile));
} catch (error) {
  console.warn(
    `[Config WARN] Tidak dapat memuat file konfigurasi untuk ${env.NODE_ENV}. Menggunakan konfigurasi dasar.`
  );
}

let config = deepmerge(baseConfig, envConfig);

config.nodeEnv = env.NODE_ENV;
config.isProduction = isProduction;

config.mongoUri = env.MONGO_URI;
config.redisUri = env.REDIS_URI;

config.jwt.secret = env.JWT_SECRET;
config.jwt.refreshSecret = env.JWT_REFRESH_SECRET;

config.google = {
  clientId: env.GOOGLE_CLIENT_ID,
  androidClientId: env.GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: env.GOOGLE_IOS_CLIENT_ID,
  validAudiences: [
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_ANDROID_CLIENT_ID,
    env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean),
};

config.agora.appId = env.AGORA_APP_ID;
config.agora.appCertificate = env.AGORA_APP_CERTIFICATE;

config.email.host = env.EMAIL_HOST || config.email.host;
config.email.user = env.EMAIL_USER || config.email.user;
config.email.pass = env.EMAIL_PASS || config.email.pass;

try {
  config.jwt.refreshExpiresInMs = ms(config.jwt.refreshExpiresIn);
  if (config.jwt.refreshExpiresInMs === undefined) {
    throw new Error(
      `Format JWT_REFRESH_EXPIRE tidak valid: "${config.jwt.refreshExpiresIn}"`
    );
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

config.port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

module.exports = config;
