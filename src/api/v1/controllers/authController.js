const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Session = require("../models/Session");
const sendEmail = require("../../../services/emailService");
const logger = require("../../../config/logger");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
};

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res, next) => {
  const { email, password, username } = req.body;
  try {
    const queryConditions = [{ email }];
    if (username) {
      queryConditions.push({ username });
    }
    const userExists = await User.findOne({ $or: queryConditions });

    if (userExists) {
      return res
        .status(400)
        .json({ message: "Email atau username sudah terdaftar" });
    }

    const finalUsername = username || email.split("@")[0];

    const user = await User.create({
      username: finalUsername,
      email,
      password,
    });
    const { accessToken, refreshToken, refreshTokenExpires } =
      generateTokens(user);

    await Session.create({
      user: user._id,
      refreshToken,
      userAgent: req.headers["user-agent"] || "Unknown",
      ip: req.ip,
      expiresAt: refreshTokenExpires,
    });

    res.status(201).json({ accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Auth user & get token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { login, password } = req.body;

  const user = await User.findOne({
    $or: [{ email: login }, { username: login }],
  }).select("+password");

  if (!user || !user.password) {
    return res.status(401).json({ message: "Kredensial tidak valid" });
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    return res.status(401).json({ message: "Kredensial tidak valid" });
  }

  const { accessToken, refreshToken, refreshTokenExpires } =
    generateTokens(user);

  await Session.create({
    user: user._id,
    refreshToken,
    userAgent: req.headers["user-agent"] || "Unknown",
    ip: req.ip,
    expiresAt: refreshTokenExpires,
  });

  res.json({ accessToken, refreshToken });
});

/**
 * @desc    Google OAuth for mobile
 * @route   POST /api/v1/auth/google/mobile
 * @access  Public
 */
exports.loginWithGoogle = async (req, res, next) => {
  const { accessToken: googleToken } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: googleToken,
      audience: [
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ],
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(400).json({ message: "Token Google tidak valid" });
    }

    let user = await User.findOne({ email: payload.email });

    if (!user) {
      user = await User.create({
        name: payload.name,
        email: payload.email,
        isVerified: true,
      });
    }

    const { accessToken, refreshToken, refreshTokenExpires } =
      generateTokens(user);

    await Session.create({
      user: user._id,
      refreshToken,
      userAgent: req.headers["user-agent"] || "Google Auth",
      ip: req.ip,
      expiresAt: refreshTokenExpires,
    });

    res.json({ accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  let user;
  try {
    user = await User.findOne({ email: req.body.email });
    if (!user) {
      logger.warn(
        `Permintaan reset password untuk email tidak terdaftar: ${req.body.email}`
      );
      return res.status(200).json({
        message: "Jika email terdaftar, instruksi reset akan dikirim.",
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Reset Password TemanDifa",
      text: `Anda menerima email ini karena Anda (atau orang lain) meminta reset password untuk akun Anda.\n\nKlik link berikut, atau paste ke browser Anda untuk menyelesaikan proses:\n\n${resetUrl}\n\nJika Anda tidak memintanya, abaikan email ini.`,
    });

    res
      .status(200)
      .json({ message: "Email untuk reset kata sandi telah dikirim" });
  } catch (error) {
    logger.error("Gagal mengirim email reset password:", error);
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/resetpassword/:token
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token reset tidak valid atau telah kedaluwarsa" });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await Session.deleteMany({ user: user._id });

    res.status(200).json({ message: "Password berhasil direset" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshTokens = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token diperlukan" });
  }

  try {
    const session = await Session.findOne({ refreshToken });
    const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (!session || !decoded) {
      await Session.deleteOne({ refreshToken });
      return res.status(403).json({
        message: "Refresh token tidak valid atau sesi telah berakhir",
      });
    }

    session.lastActiveAt = Date.now();
    await session.save();

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan" });
    }

    const { accessToken } = generateTokens(user);
    res.json({ accessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body;
  try {
    await Session.deleteOne({ refreshToken });
    res.status(200).json({ message: "Logout berhasil" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all active user sessions
 * @route   GET /api/v1/auth/sessions
 * @access  Private
 */
exports.getSessions = asyncHandler(async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.user.id }).sort({
      lastActiveAt: -1,
    });

    const currentToken = req.body?.refreshToken;

    const sanitizedSessions = sessions.map((session) => ({
      id: session._id,
      userAgent: session.userAgent,
      ip: session.ip,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt,
      isCurrent: session.refreshToken === currentToken,
    }));
    res.json(sanitizedSessions);
  } catch (error) {
    next(error);
  }
});

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/v1/auth/sessions/:id
 * @access  Private
 */
exports.revokeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({ message: "Sesi tidak ditemukan" });
    }

    if (session.user.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Tidak diizinkan untuk menghapus sesi ini" });
    }

    await session.deleteOne();
    res.status(200).json({ message: "Sesi berhasil dihapus" });
  } catch (error) {
    next(error);
  }
};
