const winston = require("winston");
const config = require("./appConfig");
const { combine, timestamp, json, printf, errors, colorize } = winston.format;

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
  level: config.isProduction ? "info" : "debug",
  format: config.isProduction ? prodFormat : devFormat,
  defaultMeta: { service: "api-gateway" },
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

/**
 * Fungsi helper untuk log standar dengan konteks request.
 * @param {'info' | 'warn' | 'error' | 'debug'} level - Level log.
 * @param {string} message - Pesan log.
 * @param {object} req - Objek request Express (opsional).
 * @param {object} [meta={}] - Metadata tambahan (opsional).
 */
const logWithContext = (level, message, req, meta = {}) => {
  const logMeta = {
    ...meta,
    ...(req && req.id && { requestId: req.id }),
    ...(req && req.userId && { userId: req.userId }),
  };
  logger.log(level, message, logMeta);
};

/**
 * Fungsi helper untuk log error dengan konteks request dan detail error.
 * @param {string} message - Pesan log error.
 * @param {Error | any} error - Objek error.
 * @param {object} req - Objek request Express (opsional).
 * @param {object} [meta={}] - Metadata tambahan (opsional).
 */
const errorWithContext = (message, error, req, meta = {}) => {
  const logMeta = {
    ...meta,
    ...(req && req.id && { requestId: req.id }),
    ...(req && req.userId && { userId: req.userId }),
    ...(error instanceof Error
      ? {
          errorMessage: error.message,
          errorName: error.name,
          stack: error.stack,
          ...(error.isAxiosError && {
            axiosErrorCode: error.code,
            axiosRequestUrl: error.config?.url,
          }),
        }
      : { errorDetails: String(error) }),
  };
  logger.error(message, logMeta);
};

module.exports = {
  logger,
  addUserToReq,
  logWithContext,
  errorWithContext,
};
