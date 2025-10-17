const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Session = require("../models/Session");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Menghasilkan access token dan refresh token untuk pengguna.
 */
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken, refreshTokenExpires };
};

/**
 * Membuat dan menyimpan sesi login baru untuk pengguna.
 */
const createSession = async (user, req, userAgentOverride = null) => {
  const { accessToken, refreshToken, refreshTokenExpires } =
    generateTokens(user);

  await Session.create({
    user: user._id,
    refreshToken,
    userAgent: userAgentOverride || req.headers["user-agent"] || "Unknown",
    ip: req.ip,
    expiresAt: refreshTokenExpires,
  });

  return { accessToken, refreshToken };
};

/**
 * Logika untuk mendaftarkan pengguna baru.
 */
const registerUser = async (email, password, username) => {
  const queryConditions = [{ email }];
  if (username) {
    queryConditions.push({ username });
  }
  const userExists = await User.findOne({ $or: queryConditions });

  if (userExists) {
    const error = new Error("Email atau username sudah terdaftar");
    error.status = 400;
    throw error;
  }

  const finalUsername = username || email.split("@")[0];
  const user = await User.create({ username: finalUsername, email, password });

  return user;
};

/**
 * Logika untuk login pengguna dengan email/password.
 */
const loginUser = async (login, password) => {
  const user = await User.findOne({
    $or: [{ email: login }, { username: login }],
  }).select("+password");

  if (!user || !user.password) {
    const error = new Error("Kredensial tidak valid");
    error.status = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    const error = new Error("Kredensial tidak valid");
    error.status = 401;
    throw error;
  }

  return user;
};

/**
 * Logika untuk login atau register dengan Google.
 */
const loginOrRegisterWithGoogle = async (googleToken) => {
  const ticket = await client.verifyIdToken({
    idToken: googleToken,
    audience: [
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ],
  });
  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    const error = new Error("Token Google tidak valid");
    error.status = 400;
    throw error;
  }

  let user = await User.findOne({ email: payload.email });

  if (!user) {
    const username =
      payload.email.split("@")[0] + Math.floor(Math.random() * 1000);
    user = await User.create({
      name: payload.name,
      email: payload.email,
      username: username,
      isVerified: true,
    });
  }

  return user;
};

module.exports = {
  registerUser,
  loginUser,
  loginOrRegisterWithGoogle,
  createSession,
};
