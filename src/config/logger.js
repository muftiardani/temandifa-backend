const winston = require("winston");
const { format } = winston;
const { combine, timestamp, printf, colorize, json, errors } = format;

const passRequestId = format((info) => {
  if (info.requestId) {
    info.requestId = info.requestId;
  }
  return info;
});

const devFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf(({ level, message, timestamp, requestId, stack }) => {
    const reqId = requestId ? `[${requestId}] ` : "";
    const stackTrace = stack ? `\n${stack}` : "";
    return `${timestamp} ${level}: ${reqId}${message}${stackTrace}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  passRequestId(),
  json()
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  exitOnError: false,
});

module.exports = logger;
