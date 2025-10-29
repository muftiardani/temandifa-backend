const mongoose = require("mongoose");
const { logger } = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {});

    if (logger && typeof logger.info === "function") {
      logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } else {
      console.log(
        `MongoDB Connected: ${conn.connection.host} (logger not available for info)`
      );
    }
  } catch (error) {
    if (logger && typeof logger.error === "function") {
      logger.error(`Error connecting to MongoDB: ${error.message}`);
    } else {
      console.error(
        `Error connecting to MongoDB (logger not available): ${error.message}`
      );
    }
    throw error;
  }
};

module.exports = connectDB;
