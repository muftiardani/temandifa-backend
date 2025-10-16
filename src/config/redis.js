const { createClient } = require("redis");
const logger = require("./logger");

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || "localhost"}:${
    process.env.REDIS_PORT || 6379
  }`,
});

redisClient.on("error", (err) => logger.error("Koneksi Redis Error:", err));

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      logger.info("Terhubung ke Redis");
    }
  } catch (err) {
    logger.error("Gagal terhubung ke Redis saat startup:", err);
    process.exit(1);
  }
};

module.exports = { redisClient, connectRedis };
