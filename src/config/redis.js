const redis = require("redis");
const logger = require("./logger");

const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = process.env.REDIS_PORT || 6379;

const redisClient = redis.createClient({
  url: `redis://${redisHost}:${redisPort}`,
});

redisClient.on("connect", () => {
  logger.info("Terhubung ke Redis...");
});

redisClient.on("error", (err) => {
  logger.error("Koneksi Redis Error:", err);
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error("Gagal terhubung ke Redis:", err);
  }
})();

module.exports = redisClient;
