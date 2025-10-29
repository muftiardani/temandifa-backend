const redis = require("redis");
const { logger } = require("./logger");

const redisClient = redis.createClient({
  url:
    process.env.REDIS_URI ||
    `redis://${process.env.REDIS_HOST || "redis"}:${
      process.env.REDIS_PORT || 6379
    }`,
});

redisClient.on("error", (err) => {
  if (logger && typeof logger.error === "function") {
    logger.error(`Koneksi Redis Error: ${err.message}`);
  } else {
    console.error(`Redis Client Error (logger not available): ${err.message}`);
  }
});

redisClient.on("connect", () => {
  if (logger && typeof logger.info === "function") {
    logger.info("Redis client connected");
  } else {
    console.log("Redis client connected (logger not available for info)");
  }
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (err) {
    if (logger && typeof logger.error === "function") {
      logger.error(`Gagal terhubung ke Redis saat startup: ${err.message}`);
    } else {
      console.error(
        `Gagal terhubung ke Redis saat startup (logger not available): ${err.message}`
      );
    }
    throw err;
  }
};

module.exports = { redisClient, connectRedis };
