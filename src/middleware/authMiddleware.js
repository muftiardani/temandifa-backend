const jwt = require("jsonwebtoken");
const logger = require("../config/logger");

const protect = (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = { id: decoded.id };

      next();
    } catch (error) {
      logger.error("Token tidak valid");
      return res
        .status(401)
        .json({ message: "Tidak terautentikasi, token gagal." });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Tidak terautentikasi, tidak ada token." });
  }
};

module.exports = { protect };
