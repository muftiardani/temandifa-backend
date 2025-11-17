const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../api/v1/models/User");
const Session = require("../api/v1/models/Session");
const { logWithContext, errorWithContext } = require("../config/logger");
const config = require("../config/appConfig");
const { redisClient } = require("../config/redis");
const CircuitBreaker = require("opossum");

const getUserProfileCacheKey = (userId) => `user_profile:${userId}`;
const getSessionCacheKey = (sessionId) => `session_valid:${sessionId}`;
const USER_PROFILE_CACHE_TTL = 3600;

const redisCircuitOptions = {
  timeout: 1000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const redisGetWrapper = (key) => redisClient.get(key);

const userCacheBreaker = new CircuitBreaker(
  redisGetWrapper,
  redisCircuitOptions
);
const sessionCacheBreaker = new CircuitBreaker(
  redisGetWrapper,
  redisCircuitOptions
);

userCacheBreaker.on("open", () =>
  logWithContext(
    "warn",
    "Circuit Breaker DIBUKA untuk userCache (Redis). Fallback ke DB.",
    null
  )
);
userCacheBreaker.on("close", () =>
  logWithContext(
    "info",
    "Circuit Breaker DITUTUP untuk userCache (Redis).",
    null
  )
);

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, config.jwt.secret);

      if (!decoded.sid) {
        logWithContext("warn", "Access token missing session ID (sid)", req, {
          userIdFromToken: decoded.id,
        });
        res.status(401);
        throw new Error("Otorisasi gagal, token tidak lengkap (sid)");
      }

      const userCacheKey = getUserProfileCacheKey(decoded.id);
      const sessionCacheKey = getSessionCacheKey(decoded.sid);

      try {
        const [cachedUser, cachedSession] = await Promise.all([
          userCacheBreaker.fire(userCacheKey),
          sessionCacheBreaker.fire(sessionCacheKey),
        ]);

        if (cachedUser && cachedSession) {
          const user = JSON.parse(cachedUser);

          req.user = user;
          req.sessionId = decoded.sid;
          logWithContext(
            "debug",
            `User authorized successfully from CACHE (User + Session)`,
            req
          );
          return next();
        }
      } catch (cacheError) {
        errorWithContext(
          "Redis cache error/unavailable during auth. Degrading to DB.",
          cacheError,
          req
        );
      }

      const [user, validSession] = await Promise.all([
        User.findById(decoded.id).select("-password").lean(),
        Session.findById(decoded.sid).select("_id").lean(),
      ]);

      if (!user) {
        logWithContext("warn", "User associated with token not found", req, {
          userIdFromToken: decoded.id,
        });
        res.status(401);
        throw new Error("Otorisasi gagal, pengguna tidak ditemukan");
      }

      if (!validSession) {
        logWithContext(
          "warn",
          `Authorization failed: Session ID ${decoded.sid} not found in DB (e.g., logged out)`,
          req,
          { userId: user._id }
        );
        res.status(401);
        throw new Error(
          "Otorisasi gagal, sesi tidak valid atau telah berakhir"
        );
      }

      try {
        const multi = redisClient.multi();
        multi.set(userCacheKey, JSON.stringify(user), {
          EX: USER_PROFILE_CACHE_TTL,
        });
        multi.set(sessionCacheKey, "1", {
          EX: Math.floor(config.jwt.refreshExpiresInMs / 1000),
        });
        await multi.exec();
      } catch (cacheError) {
        errorWithContext(
          "Redis SET error during auth (non-critical)",
          cacheError,
          req
        );
      }

      req.user = user;
      req.sessionId = decoded.sid;

      logWithContext("debug", `User authorized successfully via DB`, req);
      next();
    } catch (error) {
      errorWithContext(
        "Authorization failed: Token verification error",
        error,
        req
      );
      res.status(401);
      if (error.name === "TokenExpiredError") {
        throw new Error("Otorisasi gagal, token kedaluwarsa");
      } else {
        throw new Error(error.message || "Otorisasi gagal, token tidak valid");
      }
    }
  }

  if (!token) {
    logWithContext(
      "warn",
      "Authorization failed: No token provided or invalid format",
      req
    );
    res.status(401);
    throw new Error("Otorisasi gagal, tidak ada token");
  }
});

module.exports = { protect };
