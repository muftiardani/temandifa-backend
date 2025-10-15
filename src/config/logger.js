const winston = require("winston");
const { format } = winston;
const { combine, timestamp, printf, colorize, json } = format;

const devFormat = printf(({ level, message, timestamp, requestId }) => {
  return `${timestamp} [${requestId || "N/A"}] ${level}: ${message}`;
});

const prodFormat = combine(
  timestamp(),
  winston.format((info) => {
    const { requestId } = info;
    if (requestId) {
      info.requestId = requestId;
    }
    return info;
  })(),
  json()
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format:
    process.env.NODE_ENV === "production"
      ? prodFormat
      : combine(
          colorize(),
          timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          devFormat
        ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
