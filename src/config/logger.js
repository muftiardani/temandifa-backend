const winston = require("winston");
const { combine, timestamp, json, printf, errors, label, colorize } =
  winston.format;

const addUserToReq = (req, res, next) => {
  if (req.user && req.user.id) {
    req.userId = req.user.id;
  }
  next();
};

const devFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, requestId, userId, service }) => {
    let log = `${timestamp} ${level}`;
    if (service) log += ` [${service}]`;
    if (requestId) log += ` [req:${requestId}]`;
    if (userId) log += ` [user:${userId}]`;
    log += `: ${message}`;
    if (stack) log += `\n${stack}`;
    return log;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  defaultMeta: { service: "api-gateway" },
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

const logWithContext = (level, message, req, meta = {}) => {
  const logMeta = {
    ...meta,
    ...(req && req.id && { requestId: req.id }),
    ...(req && req.userId && { userId: req.userId }),
  };
  logger.log(level, message, logMeta);
};

const errorWithContext = (message, error, req, meta = {}) => {
  const logMeta = {
    ...meta,
    ...(req && req.id && { requestId: req.id }),
    ...(req && req.userId && { userId: req.userId }),
    ...(error instanceof Error && {
      errorMessage: error.message,
      errorName: error.name,
      stack: error.stack,
    }),
    ...(!(error instanceof Error) && { errorDetails: String(error) }),
  };
  logger.error(message, logMeta);
};

module.exports = { logger, addUserToReq, logWithContext, errorWithContext };
