const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB Terhubung: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`Error koneksi MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
