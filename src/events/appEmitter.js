const EventEmitter = require("events");
const { createClient } = require("redis");
const config = require("../config/appConfig");
const { logger } = require("../config/logger");

class RedisEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.pubClient = createClient({ url: config.redisUri });
    this.subClient = this.pubClient.duplicate();
    this.channel = "temandifa:app-events";
    this.isReady = false;
  }

  /**
   * Inisialisasi koneksi Redis untuk Pub/Sub
   */
  async initialize() {
    if (this.isReady) return;

    this.pubClient.on("error", (err) =>
      logger.error("AppEmitter Pub Client Error:", err)
    );
    this.subClient.on("error", (err) =>
      logger.error("AppEmitter Sub Client Error:", err)
    );

    try {
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      await this.subClient.subscribe(this.channel, (message) => {
        try {
          const { event, data } = JSON.parse(message);
          super.emit(event, data);
        } catch (parseError) {
          logger.error(
            "Error parsing Redis message in AppEmitter:",
            parseError
          );
        }
      });

      this.isReady = true;
      logger.info("Redis Pub/Sub AppEmitter initialized successfully.");
    } catch (error) {
      logger.error("Failed to initialize Redis AppEmitter:", error);
      throw error;
    }
  }

  /**
   * Override method emit.
   * Alih-alih memicu event lokal saja, kita publish ke Redis
   * agar semua worker (termasuk diri sendiri) menerimanya.
   */
  emit(event, data) {
    if (!this.isReady) {
      logger.warn(
        `AppEmitter not ready. Falling back to local emit for event: ${event}`
      );
      return super.emit(event, data);
    }

    this.pubClient.publish(this.channel, JSON.stringify({ event, data }));
    return true;
  }

  /**
   * Tutup koneksi saat shutdown
   */
  async close() {
    if (this.pubClient.isOpen) await this.pubClient.quit();
    if (this.subClient.isOpen) await this.subClient.quit();
    this.isReady = false;
  }
}

const appEmitter = new RedisEventEmitter();

module.exports = appEmitter;
