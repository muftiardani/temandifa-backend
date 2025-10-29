const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../api/v1/models/User");
const { logWithContext, errorWithContext } = require("../config/logger");

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("-password").lean();

      if (!user) {
        logWithContext("warn", "User associated with token not found", req, {
          userIdFromToken: decoded.id,
        });
        res.status(401);
        throw new Error("Otorisasi gagal, pengguna tidak ditemukan");
      }

      req.user = user;

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
        throw new Error("Otorisasi gagal, token tidak valid");
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
    throw new Error("Otorisasi gagal, tidak ada token.");
  }
});

module.exports = { protect };
