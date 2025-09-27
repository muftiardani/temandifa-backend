const winston = require("winston");
const { jsonFormatter } = require("winston-json-formatter");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    jsonFormatter()
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
