const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../api/v1/models/User");
const Session = require("../api/v1/models/Session");
const { logWithContext, errorWithContext } = require("../config/logger");
const config = require("../config/appConfig");
const { redisClient } = require("../config/redis");

const getUserProfileCacheKey = (userId) => `user_profile:${userId}`;
const USER_PROFILE_CACHE_TTL = 3600;

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

      try {
        const cachedUser = await redisClient.get(userCacheKey);
        if (cachedUser) {
          const user = JSON.parse(cachedUser);

          const validSession = await Session.findById(decoded.sid)
            .select("_id")
            .lean();

          if (validSession) {
            req.user = user;
            req.sessionId = decoded.sid;
            logWithContext(
              "debug",
              `User authorized successfully from CACHE`,
              req
            );
            return next();
          }
          await redisClient.del(userCacheKey);
        }
      } catch (cacheError) {
        errorWithContext("Redis GET error during auth", cacheError, req);
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
        await redisClient.set(userCacheKey, JSON.stringify(user), {
          EX: USER_PROFILE_CACHE_TTL,
        });
      } catch (cacheError) {
        errorWithContext("Redis SET error during auth", cacheError, req);
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
