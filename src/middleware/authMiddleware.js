const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../api/v1/models/User");
const Session = require("../api/v1/models/Session");
const { logWithContext, errorWithContext } = require("../config/logger");
const config = require("../config/appConfig");

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

      const [user, validSession] = await Promise.all([
        User.findById(decoded.id).select("-password"),
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

      req.user = user;
      req.sessionId = decoded.sid;

      logWithContext("debug", `User authorized successfully via token`, req);
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
