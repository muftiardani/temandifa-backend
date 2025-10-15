const User = require("../models/User");
const Token = require("../models/Token");
const jwt = require("jsonwebtoken");
const { sendPasswordResetEmail } = require("../../../services/emailService");
const crypto = require("crypto");
const logger = require("../../../config/logger");

/**
 * Fungsi helper untuk membuat access dan refresh token.
 * @param {object} user - Objek pengguna dari Mongoose.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    {
      expiresIn: "15m",
    }
  );
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );

  await Token.findOneAndDelete({ userId: user._id });
  await new Token({ userId: user._id, token: refreshToken }).save();

  return { accessToken, refreshToken };
};

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  const { username, email, password } = req.body;
  try {
    const user = await User.create({ username, email, password });
    const tokens = await generateTokens(user);
    res.status(201).json(tokens);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ success: false, message: "Email sudah terdaftar." });
    }
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  const { login, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ email: login }, { username: login }],
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res
        .status(401)
        .json({ success: false, message: "Kredensial tidak valid" });
    }

    const tokens = await generateTokens(user);
    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth Callback for mobile
// @route   POST /api/v1/auth/google/mobile
// @access  Public
exports.googleAuthCallback = async (req, res, next) => {
  if (!req.user) {
    return res
      .status(400)
      .json({ success: false, message: "Otentikasi Google gagal." });
  }
  try {
    const tokens = await generateTokens(req.user);
    res.status(200).json(tokens);
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  let user;
  try {
    user = await User.findOne({ email: req.body.email });

    if (!user) {
      logger.warn(
        `Permintaan reset password untuk email tidak terdaftar: ${req.body.email}`
      );
      return res.status(200).json({
        success: true,
        data: "Jika email terdaftar, instruksi reset akan dikirim.",
      });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    res.status(200).json({
      success: true,
      data: "Email untuk reset kata sandi telah dikirim",
    });
  } catch (error) {
    logger.error("Gagal mengirim email reset password:", error);
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
    return res
      .status(500)
      .json({ success: false, message: "Gagal mengirim email" });
  }
};

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token reset tidak valid atau telah kedaluwarsa",
      });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res
      .status(200)
      .json({ success: true, data: "Kata sandi berhasil direset" });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, message: "Refresh token diperlukan" });
  }

  try {
    const storedToken = await Token.findOne({ token: refreshToken });
    if (!storedToken) {
      return res
        .status(403)
        .json({ success: false, message: "Refresh token tidak valid" });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Pengguna tidak ditemukan" });
    }

    const tokens = await generateTokens(user);
    res.status(200).json(tokens);
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(403).json({
        success: false,
        message: "Refresh token tidak valid atau kedaluwarsa.",
      });
    }
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Public
exports.logout = async (req, res, next) => {
  const { refreshToken } = req.body;
  try {
    await Token.findOneAndDelete({ token: refreshToken });
    res.status(200).json({ success: true, message: "Logout berhasil" });
  } catch (error) {
    next(error);
  }
};
